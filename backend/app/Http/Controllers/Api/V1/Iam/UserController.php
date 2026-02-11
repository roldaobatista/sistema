<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Traits\AppliesTenantScope;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

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
            ->with('roles:id,name');

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
            'password' => 'required|string|min:8',
            'roles' => 'array',
            'roles.*' => ['integer', Rule::exists('roles', 'id')->where(function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
            })],
            'is_active' => 'boolean',
        ]);

        $user = DB::transaction(function () use ($validated, $tenantId) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => $validated['password'],
                'is_active' => $validated['is_active'] ?? true,
                'tenant_id' => $tenantId,
                'current_tenant_id' => $tenantId,
            ]);

            $user->tenants()->attach($tenantId, ['is_default' => true]);

            if (!empty($validated['roles'])) {
                $user->syncRoles($validated['roles']);
            }

            return $user;
        });

        $user->load('roles:id,name');

        return response()->json($user, 201);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        $user->load(['roles:id,name', 'roles.permissions:id,name']);

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
            'password' => 'nullable|string|min:8',
            'roles' => 'array',
            'roles.*' => ['integer', Rule::exists('roles', 'id')->where(function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
            })],
            'is_active' => 'boolean',
        ]);

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

        $user->load('roles:id,name');

        return response()->json($user);
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
                // Melhorar mensagem de erro para indicar onde está o vínculo
                $prettyName = str_replace('_', ' ', $table);
                return response()->json([
                    'message' => "Este usuário possui registros vinculados em '{$prettyName}'. Desative-o ao invés de excluir.",
                ], 422);
            }
        }

        // Revoga tokens e exclui permanentemente (atômico)
        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            $user->tenants()->detach();
            $user->delete();
        });

        return response()->json(null, 204);
    }

    public function toggleActive(Request $request, User $user): JsonResponse
    {
        $this->resolveTenantUser($user, $this->tenantId($request));

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Você não pode desativar sua própria conta.'], 422);
        }

        $user->update(['is_active' => !$user->is_active]);

        // Revogar tokens ao desativar para impedir acesso contínuo
        if (!$user->is_active) {
            $user->tokens()->delete();
        }

        return response()->json(['is_active' => $user->is_active]);
    }

    /**
     * Reset de senha por admin (IAM).
     */
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $this->resolveTenantUser($user, $tenantId);

        $validated = $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user->update(['password' => $validated['password']]);

        return response()->json(['message' => 'Senha atualizada.']);
    }

    /**
     * Dropdown: lista users ativos por role(s).
     * GET /users/by-role/tecnico ou /users/by-role/tecnico,vendedor
     */
    public function byRole(Request $request, string $role): JsonResponse
    {
        $roles = explode(',', $role);
        $tenantId = $this->tenantId($request);

        $users = User::whereHas('tenants', fn ($q) => $q->where('tenants.id', $tenantId))
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', $roles))
            ->with('roles:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return response()->json($users);
    }

    /**
     * Gap #20 - Troca de senha pelo proprio usuario
     */
    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($validated['current_password'], $request->user()->password)) {
            return response()->json(['message' => 'Senha atual incorreta.'], 422);
        }

        $request->user()->update(['password' => $validated['new_password']]);

        return response()->json(['message' => 'Senha alterada com sucesso.']);
    }
}
