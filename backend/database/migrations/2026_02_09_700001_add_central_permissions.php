<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    public function up(): void
    {
        $group = \App\Models\PermissionGroup::firstOrCreate(
            ['name' => 'Central'],
            ['order' => 99]
        );

        $permissions = [
            ['name' => 'central.view.self', 'criticality' => 'LOW'],
            ['name' => 'central.view.team', 'criticality' => 'LOW'],
            ['name' => 'central.view.company', 'criticality' => 'MED'],
            ['name' => 'central.create.task', 'criticality' => 'LOW'],
            ['name' => 'central.assign', 'criticality' => 'MED'],
            ['name' => 'central.close.self', 'criticality' => 'LOW'],
            ['name' => 'central.close.any', 'criticality' => 'HIGH'],
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(
                ['name' => $perm['name'], 'guard_name' => 'web'],
                ['group_id' => $group->id, 'criticality' => $perm['criticality']]
            );
        }

        // Atribuir permissões básicas aos roles existentes
        $rolePermissions = [
            'super_admin' => ['central.view.self', 'central.view.team', 'central.view.company', 'central.create.task', 'central.assign', 'central.close.self', 'central.close.any'],
            'admin' => ['central.view.self', 'central.view.team', 'central.view.company', 'central.create.task', 'central.assign', 'central.close.self', 'central.close.any'],
            'gerente' => ['central.view.self', 'central.view.team', 'central.create.task', 'central.assign', 'central.close.self', 'central.close.any'],
            'tecnico' => ['central.view.self', 'central.create.task', 'central.close.self'],
            'atendente' => ['central.view.self', 'central.create.task', 'central.close.self'],
            'vendedor' => ['central.view.self', 'central.create.task', 'central.close.self'],
            'financeiro' => ['central.view.self', 'central.view.team', 'central.create.task', 'central.close.self'],
        ];

        foreach ($rolePermissions as $roleName => $perms) {
            $role = \Spatie\Permission\Models\Role::where('name', $roleName)->first();
            if ($role) {
                $role->givePermissionTo($perms);
            }
        }
    }

    public function down(): void
    {
        Permission::where('name', 'LIKE', 'central.%')->delete();
    }
};
