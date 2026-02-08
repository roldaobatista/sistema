<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::withCount('permissions', 'users')
            ->orderBy('name')
            ->get();

        return response()->json($roles);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:roles,name',
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ]);

        if (!empty($validated['permissions'])) {
            $role->syncPermissions($validated['permissions']);
        }

        $role->load('permissions:id,name');

        return response()->json($role, 201);
    }

    public function show(Role $role): JsonResponse
    {
        $role->load('permissions:id,name,group_id,criticality');
        $role->loadCount('users');
        return response()->json($role);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        if ($role->name === 'super_admin') {
            return response()->json(['message' => 'A role super_admin não pode ser editada.'], 422);
        }

        $validated = $request->validate([
            'name' => "sometimes|string|max:100|unique:roles,name,{$role->id}",
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        if (isset($validated['name'])) {
            $role->update(['name' => $validated['name']]);
        }

        if (isset($validated['permissions'])) {
            $role->syncPermissions($validated['permissions']);
        }

        $role->load('permissions:id,name');

        return response()->json($role);
    }

    public function destroy(Role $role): JsonResponse
    {
        if (in_array($role->name, ['super_admin', 'admin'])) {
            return response()->json(['message' => 'Roles do sistema não podem ser excluídas.'], 422);
        }

        $role->delete();
        return response()->json(null, 204);
    }
}
