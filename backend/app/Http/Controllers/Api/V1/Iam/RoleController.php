<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Traits\AppliesTenantScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\Role;
use Illuminate\Support\Facades\DB;
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

        $roles = Role::withCount('permissions')
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
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        $role = DB::transaction(function () use ($validated, $tenantId) {
            $role = Role::create([
                'name' => $validated['name'],
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

        if (isset($validated['name'])) {
            $role->update(['name' => $validated['name']]);
        }

        if (isset($validated['permissions'])) {
            $role->syncPermissions($validated['permissions']);
        }

        $role->load('permissions:id,name');

        return response()->json($role);
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

        $role->delete();
        return response()->json(null, 204);
    }
}
