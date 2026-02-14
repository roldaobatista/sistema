<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Traits\AppliesTenantScope;
use App\Models\PermissionGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Models\Permission;
use App\Models\Role;
use App\Models\AuditLog;

class PermissionController extends Controller
{
    use AppliesTenantScope;

    /**
     * Lista permissões agrupadas por módulo.
     */
    public function index(Request $request): JsonResponse
    {
        $this->applyTenantScope($request);

        $search = $request->query('search');

        $groups = PermissionGroup::with(['permissions' => fn ($q) => $q->orderBy('name')])
            ->orderBy('order')
            ->when($search, function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhereHas('permissions', fn ($p) => $p->where('name', 'LIKE', "%{$search}%"));
            })
            ->get()
            ->map(fn ($group) => [
                'id' => $group->id,
                'name' => $group->name,
                'permissions' => $group->permissions->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'criticality' => $p->criticality,
                ]),
            ]);

        return response()->json($groups);
    }

    /**
     * Retorna a matriz de permissões (groups x roles).
     * Otimizado com eager loading para evitar N+1 queries.
     */
    public function matrix(Request $request): JsonResponse
    {
        $this->applyTenantScope($request);

        $groups = PermissionGroup::with(['permissions' => fn ($q) => $q->orderBy('name')])
            ->orderBy('order')
            ->get();

        $tenantId = (int) app('current_tenant_id');
        $roles = Role::with('permissions:id,name')
            ->where(function ($query) use ($tenantId) {
                $query->where('tenant_id', $tenantId)
                      ->orWhereNull('tenant_id');
            })
            ->orderBy('name')
            ->get();

        $matrix = $groups->map(function ($group) use ($roles) {
            return [
                'group' => $group->name,
                'permissions' => $group->permissions->map(function ($perm) use ($roles) {
                    return [
                        'id' => $perm->id,
                        'name' => $perm->name,
                        'criticality' => $perm->criticality,
                        'roles' => $roles->mapWithKeys(fn ($role) => [
                            $role->name => $role->permissions->contains('name', $perm->name),
                        ]),
                    ];
                }),
            ];
        });

        return response()->json([
            'roles' => $roles->pluck('name'),
            'matrix' => $matrix,
        ]);
    }

    /**
     * POST /permissions/toggle — ativa/desativa uma permissão para uma role.
     */
    public function toggleRolePermission(Request $request): JsonResponse
    {
        $this->applyTenantScope($request);

        $validated = $request->validate([
            'role_id' => 'required|integer|exists:roles,id',
            'permission_id' => 'required|integer|exists:permissions,id',
        ]);

        $tenantId = (int) app('current_tenant_id');
        $role = Role::where(function ($q) use ($tenantId) {
            $q->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
        })->findOrFail($validated['role_id']);

        if ($role->name === 'super_admin') {
            return response()->json(['message' => 'Permissões do super_admin não podem ser alteradas.'], 422);
        }

        $permission = Permission::findOrFail($validated['permission_id']);

        try {
            $hasPermission = $role->hasPermissionTo($permission);

            if ($hasPermission) {
                $role->revokePermissionTo($permission);
            } else {
                $role->givePermissionTo($permission);
            }

            app()->make(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

            AuditLog::log('updated', "Permissão '{$permission->name}' " . (!$hasPermission ? 'concedida' : 'revogada') . " para role '{$role->name}'", $role);

            return response()->json([
                'granted' => !$hasPermission,
                'message' => !$hasPermission
                    ? "Permissão '{$permission->name}' concedida à role '{$role->name}'."
                    : "Permissão '{$permission->name}' revogada da role '{$role->name}'.",
            ]);
        } catch (\Exception $e) {
            Log::error('Permission toggle failed', [
                'role_id' => $role->id,
                'permission_id' => $permission->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Erro ao alterar permissão.'], 500);
        }
    }
}
