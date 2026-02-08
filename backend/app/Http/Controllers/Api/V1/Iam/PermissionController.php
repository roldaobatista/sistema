<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use App\Models\PermissionGroup;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    /**
     * Lista permissões agrupadas por módulo.
     */
    public function index(): JsonResponse
    {
        $groups = PermissionGroup::orderBy('order')
            ->get()
            ->map(function ($group) {
                $permissions = Permission::where('group_id', $group->id)
                    ->orderBy('name')
                    ->get(['id', 'name', 'criticality']);

                return [
                    'id' => $group->id,
                    'name' => $group->name,
                    'permissions' => $permissions,
                ];
            });

        return response()->json($groups);
    }

    /**
     * Retorna a matriz de permissões (groups x roles).
     */
    public function matrix(): JsonResponse
    {
        $groups = PermissionGroup::orderBy('order')->get();
        $roles = \Spatie\Permission\Models\Role::orderBy('name')->get();

        $matrix = $groups->map(function ($group) use ($roles) {
            $permissions = Permission::where('group_id', $group->id)
                ->orderBy('name')
                ->get();

            return [
                'group' => $group->name,
                'permissions' => $permissions->map(function ($perm) use ($roles) {
                    return [
                        'id' => $perm->id,
                        'name' => $perm->name,
                        'criticality' => $perm->criticality,
                        'roles' => $roles->mapWithKeys(function ($role) use ($perm) {
                            return [$role->name => $role->hasPermissionTo($perm->name)];
                        }),
                    ];
                }),
            ];
        });

        return response()->json([
            'roles' => $roles->pluck('name'),
            'matrix' => $matrix,
        ]);
    }
}
