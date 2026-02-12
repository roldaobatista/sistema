<?php

use App\Models\PermissionGroup;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Notifications'],
            ['order' => 110]
        );

        $permissions = [
            ['name' => 'notifications.notification.view', 'criticality' => 'LOW'],
            ['name' => 'notifications.notification.update', 'criticality' => 'LOW'],
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(
                [
                    'name' => $permission['name'],
                    'guard_name' => 'web',
                ],
                [
                    'group_id' => $group->id,
                    'criticality' => $permission['criticality'],
                ]
            );
        }

        $roleNames = ['super_admin', 'admin', 'gerente', 'tecnico', 'atendente', 'vendedor', 'motorista', 'financeiro'];
        $permissionNames = array_column($permissions, 'name');

        foreach ($roleNames as $roleName) {
            $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if ($role) {
                $role->givePermissionTo($permissionNames);
            }
        }
    }

    public function down(): void
    {
        Permission::whereIn('name', [
            'notifications.notification.view',
            'notifications.notification.update',
        ])->delete();
    }
};
