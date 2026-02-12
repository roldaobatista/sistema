<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Traits\AppliesTenantScope;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\Role;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    use AppliesTenantScope;

    /**
     * Roles de sistema protegidas contra edição/exclusão.
     */
    private const PROTECTED_ROLES = ['super_admin', 'admin'];
    private const ROLE_SUPER_ADMIN = 'super_admin';
    private const ROLE_ADMIN = 'admin';
    private const GUARD_NAME = 'web';

    public function index(Request $request): JsonResponse
    {
        $this->applyTenantScope($request);

        $tenantId = app('current_tenant_id');

        $roles = Role::withCount(['permissions', 'users'])
            ->where(function ($query) use ($tenantId) {
                $query->where('tenant_id', $tenantId)
                      ->orWhereNull('tenant_id');
            })
            ->orderBy('name')
            ->get();

        return response()->json($roles);
    }

    public function store(Request $request): JsonResponse
    {
        $this->applyTenantScope($request);

        $tenantId = app('current_tenant_id');

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::notIn([self::ROLE_SUPER_ADMIN, self::ROLE_ADMIN]),
                Rule::unique('roles')->where(function ($query) use ($tenantId) {
                    return $query->where('tenant_id', $tenantId);
                }),
            ],
            'description' => 'nullable|string|max:500',
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        try {
            $role = DB::transaction(function () use ($validated, $tenantId) {
                $role = Role::create([
                    'name' => $validated['name'],
                    'description' => $validated['description'] ?? null,
                    'guard_name' => self::GUARD_NAME,
                    'tenant_id' => $tenantId,
                ]);

                if (!empty($validated['permissions'])) {
                    $role->syncPermissions($validated['permissions']);
                }

                return $role;
            });

            $role->load('permissions:id,name');

            return response()->json($role, 201);
        } catch (\Exception $e) {
            Log::error('Role store failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao criar role.'], 500);
        }
    }

    public function show(Request $request, Role $role): JsonResponse
    {
        $this->applyTenantScope($request);

        $tenantId = (int) app('current_tenant_id');
        abort_unless($role->tenant_id === null || (int) $role->tenant_id === $tenantId, 404);

        $role->load('permissions:id,name,group_id,criticality');
        return response()->json($role);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $this->applyTenantScope($request);

        if ($role->name === self::ROLE_SUPER_ADMIN) {
            return response()->json(['message' => 'A role super_admin não pode ser editada.'], 422);
        }

        $tenantId = (int) app('current_tenant_id');

        // Impedir edição de roles de outros tenants (caso o scope falhe ou seja burlado)
        if ($role->tenant_id && (int) $role->tenant_id !== $tenantId) {
            abort(403, 'Acesso negado a esta role.');
        }

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('roles')->ignore($role->id)->where(function ($query) use ($tenantId) {
                    return $query->where('tenant_id', $tenantId);
                }),
            ],
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        // Protege a role admin contra renomeação
        if (in_array($role->name, self::PROTECTED_ROLES, true) && isset($validated['name']) && $validated['name'] !== $role->name) {
            return response()->json(['message' => 'Roles do sistema não podem ser renomeadas.'], 422);
        }

        try {
            DB::transaction(function () use ($role, $validated) {
                $updateData = [];
                if (isset($validated['name'])) {
                    $updateData['name'] = $validated['name'];
                }
                if (array_key_exists('description', $validated)) {
                    $updateData['description'] = $validated['description'];
                }
                if (!empty($updateData)) {
                    $role->update($updateData);
                }

                if (isset($validated['permissions'])) {
                    $role->syncPermissions($validated['permissions']);
                }
            });

            $role->load('permissions:id,name');

            return response()->json($role);
        } catch (\Exception $e) {
            Log::error('Role update failed', ['role_id' => $role->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar role.'], 500);
        }
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        $this->applyTenantScope($request);

        $tenantId = (int) app('current_tenant_id');

        // Verificar que a role pertence ao tenant atual
        if ($role->tenant_id !== null && (int) $role->tenant_id !== $tenantId) {
            abort(403, 'Acesso negado a esta role.');
        }

        if (in_array($role->name, self::PROTECTED_ROLES, true)) {
            return response()->json(['message' => 'Roles do sistema não podem ser excluídas.'], 422);
        }

        // Verificar se há usuários atribuídos (query segura via pivot)
        $usersCount = DB::table('model_has_roles')
            ->where('role_id', $role->id)
            ->count();
        if ($usersCount > 0) {
            return response()->json([
                'message' => 'Esta role possui usuários atribuídos. Remova os usuários antes de excluí-la.',
            ], 422);
        }

        try {
            $role->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Role delete failed', ['role_id' => $role->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir role.'], 500);
        }
    }

    /**
     * GET /roles/{role}/users — lista os usuários atribuídos a esta role.
     */
    public function users(Request $request, Role $role): JsonResponse
    {
        $this->applyTenantScope($request);

        $tenantId = (int) app('current_tenant_id');
        abort_unless($role->tenant_id === null || (int) $role->tenant_id === $tenantId, 404);

        $users = User::whereHas('tenants', fn ($q) => $q->where('tenants.id', $tenantId))
            ->whereHas('roles', fn ($q) => $q->where('roles.id', $role->id))
            ->select('id', 'name', 'email', 'is_active')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $users]);
    }

    /**
     * POST /roles/{role}/clone — clona uma role com todas as suas permissões.
     */
    public function clone(Request $request, Role $role): JsonResponse
    {
        $this->applyTenantScope($request);

        $tenantId = (int) app('current_tenant_id');

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::notIn([self::ROLE_SUPER_ADMIN, self::ROLE_ADMIN]),
                Rule::unique('roles')->where(function ($query) use ($tenantId) {
                    return $query->where('tenant_id', $tenantId);
                }),
            ],
        ]);

        try {
            $newRole = DB::transaction(function () use ($role, $validated, $tenantId) {
                $newRole = Role::create([
                    'name' => $validated['name'],
                    'guard_name' => self::GUARD_NAME,
                    'tenant_id' => $tenantId,
                ]);

                $permissionIds = $role->permissions->pluck('id')->toArray();
                if (!empty($permissionIds)) {
                    $newRole->syncPermissions($permissionIds);
                }

                return $newRole;
            });

            $newRole->load('permissions:id,name');

            return response()->json($newRole, 201);
        } catch (\Exception $e) {
            Log::error('Role clone failed', ['role_id' => $role->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao clonar role.'], 500);
        }
    }
}
