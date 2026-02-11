<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        $newPermissions = [
            ['name' => 'central.item.view', 'criticality' => 'LOW'],
            ['name' => 'central.manage.kpis', 'criticality' => 'MED'],
            ['name' => 'central.manage.rules', 'criticality' => 'HIGH'],
        ];

        foreach ($newPermissions as $perm) {
            Permission::firstOrCreate(
                ['name' => $perm['name'], 'guard_name' => 'web'],
                ['criticality' => $perm['criticality']]
            );
        }

        $roleAssignments = [
            'super_admin' => ['central.item.view', 'central.manage.kpis', 'central.manage.rules'],
            'admin'       => ['central.item.view', 'central.manage.kpis', 'central.manage.rules'],
            'gerente'     => ['central.item.view', 'central.manage.kpis'],
            'tecnico'     => ['central.item.view'],
            'atendente'   => ['central.item.view'],
            'vendedor'    => ['central.item.view'],
            'financeiro'  => ['central.item.view', 'central.manage.kpis'],
        ];

        foreach ($roleAssignments as $roleName => $perms) {
            $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if ($role) {
                $role->givePermissionTo($perms);
            }
        }
    }

    public function down(): void
    {
        Permission::whereIn('name', [
            'central.item.view',
            'central.manage.kpis',
            'central.manage.rules',
        ])->delete();
    }
};
