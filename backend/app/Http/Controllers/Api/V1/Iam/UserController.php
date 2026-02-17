<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Traits\AppliesTenantScope;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;

class UserController extends Controller
{
    use AppliesTenantScope;

    private function tenantId(Request $request): int
    {
        $this->applyTenantScope($request);

        return (int) app('current_tenant_id');
    }

    private function resolveTenantUser(User $user, int $tenantId): User
    {
        $belongsToTenant = (int) $user->tenant_id === $tenantId
            || $user->tenants()->where('tenants.id', $tenantId)->exists();

        abort_unless($belongsToTenant, 404);

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $query = User::whereHas('tenants', fn ($q) => $q->where('tenants.id', $tenantId))
            ->with('roles:id,name,display_name');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($roleFilter = $request->get('role')) {
            $query->whereHas('roles', fn ($q) => $q->where('name', $roleFilter));
        }

        $perPage = min((int) $request->get('per_page', 15), 100);

        $users = $query->orderBy('name')
            ->paginate($perPage);

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:20',
            'password' => ['required', PasswordRule::min(8)->mixedCase()->numbers()],
            'roles' => 'array',
            'roles.*' => ['integer', Rule::exists('roles', 'id')->where(function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
            })],
            'is_active' => 'boolean',
            'branch_id' => 'nullable|integer|exists:branches,id',
        ]);

        try {
            $user = DB::transaction(function () use ($validated, $tenantId) {
                $user = User::create([
                    'name' => $validated['name'],
                    'email' => $validated['email'],
                    'phone' => $validated['phone'] ?? null,
                    'password' => $validated['password'],
                    'is_active' => $validated['is_active'] ?? true,
                    'tenant_id' => $tenantId,
                    'current_tenant_id' => $tenantId,
                    'branch_id' => $validated['branch_id'] ?? null,
                ]);

                $user->tenants()->attach($tenantId, ['is_default' => true]);

                if (!empty($validated['roles'])) {
                    $user->syncRoles($validated['roles']);
                }

                return $user;
            });

            $user->load('roles:id,name,display_name');

            AuditLog::log('created', "Usuário {$user->name} criado", $user);

            return response()->json($user, 201);
        } catch (\Exception $e) {
            Log::error('User store failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao criar usuário.'], 500);
        }
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        $user->load(['roles:id,name,display_name', 'roles.permissions:id,name']);

        return response()->json($user);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $this->resolveTenantUser($user, $tenantId);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'phone' => 'nullable|string|max:20',
            'password' => ['nullable', PasswordRule::min(8)->mixedCase()->numbers()],
            'roles' => 'array',
            'roles.*' => ['integer', Rule::exists('roles', 'id')->where(function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
            })],
            'is_active' => 'boolean',
            'branch_id' => 'nullable|integer|exists:branches,id',
        ]);

        try {
            DB::transaction(function () use ($user, $validated) {
                $data = collect($validated)->except(['roles', 'password'])->toArray();

                if (!empty($validated['password']) && trim($validated['password']) !== '') {
                    $data['password'] = $validated['password'];
                }

                $user->update($data);

                if (isset($validated['roles'])) {
                    $user->syncRoles($validated['roles']);
                }
            });

            $user->load('roles:id,name,display_name');

            AuditLog::log('updated', "Usuário {$user->name} atualizado", $user);

            return response()->json($user);
        } catch (\Exception $e) {
            Log::error('User update failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar usuário.'], 500);
        }
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $this->resolveTenantUser($user, $tenantId);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Você não pode excluir sua própria conta.'], 422);
        }

        // Verificar dependências em múltiplas tabelas antes de excluir (com escopo de tenant)
        $dependencyTables = [
            'work_orders' => ['assigned_to', 'created_by'],
            'quotes' => ['created_by'],
            'service_calls' => ['assigned_to', 'created_by'],
            'schedules' => ['user_id'],
            'expenses' => ['user_id'],
            'commission_events' => ['user_id'],
            'central_items' => ['responsavel_user_id', 'criado_por_user_id', 'closed_by'],
            'crm_deals' => ['assigned_to'],
            'technician_cash_transactions' => ['created_by'],
        ];

        foreach ($dependencyTables as $table => $columns) {
            $query = DB::table($table)->where('tenant_id', $tenantId);
            if (count($columns) === 1) {
                $query->where($columns[0], $user->id);
            } else {
                $query->where(function ($q) use ($user, $columns) {
                    foreach ($columns as $col) {
                        $q->orWhere($col, $user->id);
                    }
                });
            }
            if ($query->exists()) {
                $prettyName = str_replace('_', ' ', $table);
                return response()->json([
                    'message' => "Este usuário possui registros vinculados em '{$prettyName}'. Desative-o ao invés de excluir.",
                ], 422);
            }
        }

        try {
            DB::transaction(function () use ($user) {
                $user->tokens()->delete();
                $user->tenants()->detach();
                $user->delete();
            });

            AuditLog::log('deleted', "Usuário {$user->name} excluído", $user);

            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('User delete failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir usuário.'], 500);
        }
    }

    public function toggleActive(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Você não pode desativar sua própria conta.'], 422);
        }

        try {
            DB::beginTransaction();

            $user->update(['is_active' => !$user->is_active]);

            if (!$user->is_active) {
                $user->tokens()->delete();
            }

            DB::commit();

            AuditLog::log('status_changed', "Usuário {$user->name} " . ($user->is_active ? 'ativado' : 'desativado'), $user);

            return response()->json(['is_active' => $user->is_active]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('User toggleActive failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao alterar status do usuário.'], 500);
        }
    }

    /**
     * Reset de senha por admin (IAM).
     */
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $this->resolveTenantUser($user, $tenantId);

        $validated = $request->validate([
            'password' => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        try {
            DB::beginTransaction();

            $user->update(['password' => $validated['password']]);
            $user->tokens()->delete();

            DB::commit();

            AuditLog::log('updated', "Senha do usuário {$user->name} resetada", $user);

            return response()->json(['message' => 'Senha atualizada.']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('User resetPassword failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao redefinir senha.'], 500);
        }
    }

    /**
     * POST /users/{user}/roles — sincroniza roles de um usuário.
     */
    public function assignRoles(Request $request, User $user): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $this->resolveTenantUser($user, $tenantId);

        $validated = $request->validate([
            'roles' => 'required|array',
            'roles.*' => 'string|exists:roles,name',
        ]);

        try {
            DB::beginTransaction();

            $user->syncRoles($validated['roles']);

            DB::commit();

            $user->load('roles:id,name,display_name');

            AuditLog::log('updated', "Roles do usuário {$user->name} atualizadas", $user);

            return response()->json($user);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Assign roles failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atribuir roles.'], 500);
        }
    }

    /**
     * Dropdown: lista users ativos por role(s).
     * GET /users/by-role/tecnico ou /users/by-role/tecnico,vendedor
     */
    public function byRole(Request $request, string $role): JsonResponse
    {
        $roles = explode(',', $role);
        $tenantId = $this->tenantId($request);

        $users = $this->tenantUsersByRoles($tenantId, $roles);

        return response()->json($users);
    }

    /**
     * Lista simplificada de tecnicos ativos para modulos operacionais.
     * GET /technicians/options
     */
    public function techniciansOptions(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $users = $this->tenantUsersByRoles($tenantId, [Role::TECNICO]);

        return response()->json($users);
    }

    private function tenantUsersByRoles(int $tenantId, array $roles)
    {
        return User::query()
            ->where('is_active', true)
            ->where(function ($query) use ($tenantId) {
                $query
                    ->where('tenant_id', $tenantId)
                    ->orWhere('current_tenant_id', $tenantId)
                    ->orWhereHas('tenants', fn ($tenantQuery) => $tenantQuery->where('tenants.id', $tenantId));
            })
            ->whereHas('roles', fn ($query) => $query->whereIn('name', $roles))
            ->with('roles:id,name,display_name')
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
    }

    /**
     * GET /users/{user}/sessions — lista tokens/sessões ativas de um usuário.
     */
    public function sessions(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        $viewingOwnSessions = $request->user()->id === $user->id;
        $currentTokenId = $viewingOwnSessions
            ? $request->user()->currentAccessToken()?->id
            : null;

        $tokens = $user->tokens()
            ->select('id', 'name', 'last_used_at', 'created_at')
            ->orderByDesc('last_used_at')
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'last_used_at' => $token->last_used_at,
                'created_at' => $token->created_at,
                'is_current' => $currentTokenId !== null && $currentTokenId === $token->id,
            ]);

        return response()->json(['data' => $tokens]);
    }

    /**
     * DELETE /users/{user}/sessions/{tokenId} — revoga uma sessão específica.
     */
    public function revokeSession(Request $request, User $user, int $tokenId): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        $deleted = $user->tokens()->where('id', $tokenId)->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Sessão não encontrada.'], 404);
        }

        return response()->json(['message' => 'Sessão revogada com sucesso.']);
    }

    /**
     * POST /users/bulk-toggle-active — ativa/desativa múltiplos usuários.
     */
    public function bulkToggleActive(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'integer|exists:users,id',
            'is_active' => 'required|boolean',
        ]);

        $tenantId = $this->tenantId($request);
        $currentUserId = $request->user()->id;

        // Filter out the current user and only target tenant users
        $userIds = collect($validated['user_ids'])
            ->reject(fn ($id) => $id === $currentUserId)
            ->values()
            ->toArray();

        if (empty($userIds)) {
            return response()->json(['message' => 'Nenhum usuário válido para alterar.'], 422);
        }

        try {
            DB::beginTransaction();

            $affectedUsers = User::whereIn('id', $userIds)
                ->whereHas('tenants', fn ($q) => $q->where('tenants.id', $tenantId))
                ->get();

            $affected = $affectedUsers->count();
            User::whereIn('id', $affectedUsers->pluck('id')->toArray())
                ->update(['is_active' => $validated['is_active']]);

            // Revoke tokens for deactivated users
            if (!$validated['is_active']) {
                DB::table('personal_access_tokens')
                    ->whereIn('tokenable_id', $affectedUsers->pluck('id')->toArray())
                    ->where('tokenable_type', User::class)
                    ->delete();
            }

            DB::commit();

            $action = $validated['is_active'] ? 'ativados' : 'desativados';
            $names = $affectedUsers->pluck('name')->implode(', ');
            AuditLog::log('status_changed', "{$affected} usuário(s) {$action} em lote: {$names}");

            return response()->json([
                'message' => "{$affected} usuário(s) " . ($validated['is_active'] ? 'ativado(s)' : 'desativado(s)') . ".",
                'affected' => $affected,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Bulk toggle active failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao alterar status dos usuários.'], 500);
        }
    }

    /**
     * POST /users/{user}/force-logout — revoga TODAS as sessões de um usuário.
     */
    public function forceLogout(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Use o logout normal para encerrar sua própria sessão.'], 422);
        }

        try {
            $count = $user->tokens()->count();
            $user->tokens()->delete();

            AuditLog::log('logout', "Forçado logout do usuário {$user->name} ({$count} sessões)", $user);

            return response()->json([
                'message' => "{$count} sessão(ões) revogada(s) com sucesso.",
                'revoked' => $count,
            ]);
        } catch (\Exception $e) {
            Log::error('Force logout failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao revogar sessões.'], 500);
        }
    }

    /**
     * GET /users/export — exporta lista de usuários como CSV.
     */
    public function exportCsv(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $tenantId = $this->tenantId($request);

        $users = User::whereHas('tenants', fn ($q) => $q->where('tenants.id', $tenantId))
            ->with('roles:id,name,display_name')
            ->orderBy('name')
            ->get();

        $filename = 'usuarios_' . now()->format('Y-m-d_His') . '.csv';

        return response()->streamDownload(function () use ($users) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF"); // UTF-8 BOM
            fputcsv($handle, ['Nome', 'E-mail', 'Telefone', 'Roles', 'Status', 'Último Login', 'Criado em'], ';');

            foreach ($users as $user) {
                fputcsv($handle, [
                    $user->name,
                    $user->email,
                    $user->phone ?? '-',
                    $user->roles->map(fn ($r) => $r->display_name ?: $r->name)->implode(', '),
                    $user->is_active ? 'Ativo' : 'Inativo',
                    $user->last_login_at?->format('d/m/Y H:i') ?? 'Nunca',
                    $user->created_at?->format('d/m/Y H:i'),
                ], ';');
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * GET /users/stats — métricas do IAM dashboard.
     */
    public function stats(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $base = User::whereHas('tenants', fn ($q) => $q->where('tenants.id', $tenantId));

        $total = (clone $base)->count();
        $active = (clone $base)->where('is_active', true)->count();
        $inactive = $total - $active;
        $neverLogged = (clone $base)->whereNull('last_login_at')->count();

        $byRole = DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->join('user_tenants', function ($join) use ($tenantId) {
                $join->on('user_tenants.user_id', '=', 'model_has_roles.model_id')
                    ->where('user_tenants.tenant_id', $tenantId);
            })
            ->where('model_has_roles.model_type', User::class)
            ->selectRaw('roles.name, COUNT(*) as count')
            ->groupBy('roles.name')
            ->pluck('count', 'name');

        $recentUsers = (clone $base)
            ->select('id', 'name', 'email', 'created_at')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return response()->json([
            'total' => $total,
            'active' => $active,
            'inactive' => $inactive,
            'never_logged' => $neverLogged,
            'by_role' => $byRole,
            'recent_users' => $recentUsers,
        ]);
    }

    /**
     * GET /users/{user}/permissions — lista permissões diretas do usuário.
     */
    public function directPermissions(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        return response()->json([
            'direct_permissions' => $user->getDirectPermissions()->pluck('name'),
            'role_permissions' => $user->getPermissionsViaRoles()->pluck('name'),
            'all_permissions' => $user->getAllPermissions()->pluck('name'),
            'denied_permissions' => $user->getDeniedPermissionsList(),
            'effective_permissions' => $user->getEffectivePermissions()->pluck('name')->values(),
        ]);
    }

    /**
     * POST /users/{user}/permissions — atribui permissões diretas ao usuário.
     */
    public function grantPermissions(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        $validated = $request->validate([
            'permissions' => 'required|array|min:1',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        try {
            $user->givePermissionTo($validated['permissions']);

            AuditLog::log('updated', "Permissões diretas concedidas ao usuário {$user->name}: " . implode(', ', $validated['permissions']), $user);

            return response()->json([
                'message' => 'Permissões concedidas.',
                'direct_permissions' => $user->getDirectPermissions()->pluck('name'),
            ]);
        } catch (\Exception $e) {
            Log::error('Grant permissions failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao conceder permissões.'], 500);
        }
    }

    /**
     * DELETE /users/{user}/permissions — revoga permissões diretas do usuário.
     */
    public function revokePermissions(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        $validated = $request->validate([
            'permissions' => 'required|array|min:1',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        try {
            foreach ($validated['permissions'] as $perm) {
                $user->revokePermissionTo($perm);
            }

            AuditLog::log('updated', "Permissões diretas revogadas do usuário {$user->name}: " . implode(', ', $validated['permissions']), $user);

            return response()->json([
                'message' => 'Permissões revogadas.',
                'direct_permissions' => $user->getDirectPermissions()->pluck('name'),
            ]);
        } catch (\Exception $e) {
            Log::error('Revoke permissions failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao revogar permissões.'], 500);
        }
    }

    /**
     * PUT /users/{user}/permissions — sincroniza permissões diretas (substitui todas).
     */
    public function syncDirectPermissions(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        $validated = $request->validate([
            'permissions' => 'present|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        try {
            $user->syncPermissions($validated['permissions']);

            AuditLog::log('updated', "Permissões diretas do usuário {$user->name} sincronizadas", $user);

            return response()->json([
                'message' => 'Permissões sincronizadas.',
                'direct_permissions' => $user->getDirectPermissions()->pluck('name'),
            ]);
        } catch (\Exception $e) {
            Log::error('Sync permissions failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao sincronizar permissões.'], 500);
        }
    }

    /**
     * GET /users/{user}/denied-permissions — lista permissões negadas do usuário.
     */
    public function deniedPermissions(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        return response()->json([
            'denied_permissions' => $user->getDeniedPermissionsList(),
        ]);
    }

    /**
     * PUT /users/{user}/denied-permissions — sincroniza permissões negadas.
     */
    public function syncDeniedPermissions(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        $validated = $request->validate([
            'denied_permissions' => 'present|array',
            'denied_permissions.*' => 'string|exists:permissions,name',
        ]);

        try {
            $user->update(['denied_permissions' => $validated['denied_permissions']]);

            AuditLog::log(
                'updated',
                "Permissões negadas do usuário {$user->name} atualizadas: " . (empty($validated['denied_permissions']) ? 'nenhuma' : implode(', ', $validated['denied_permissions'])),
                $user
            );

            return response()->json([
                'message' => 'Permissões negadas atualizadas.',
                'denied_permissions' => $user->getDeniedPermissionsList(),
            ]);
        } catch (\Exception $e) {
            Log::error('Sync denied permissions failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar permissões negadas.'], 500);
        }
    }

    /**
     * GET /users/{user}/audit-trail — histórico de ações de um usuário.
     */
    public function auditTrail(Request $request, User $user): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $this->resolveTenantUser($user, $tenantId);

        $logs = AuditLog::where('tenant_id', $tenantId)
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('per_page', 20), 100));

        return response()->json($logs);
    }
}
