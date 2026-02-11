<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use App\Models\PermissionGroup;

return new class extends Migration
{
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Platform'],
            ['order' => 1]
        );

        $permissions = [
            // Tenant (Empresa)
            ['name' => 'platform.tenant.view',   'criticality' => 'LOW'],
            ['name' => 'platform.tenant.create', 'criticality' => 'HIGH'],
            ['name' => 'platform.tenant.update', 'criticality' => 'HIGH'],
            ['name' => 'platform.tenant.delete', 'criticality' => 'HIGH'],
            // Branch (Filial)
            ['name' => 'platform.branch.view',   'criticality' => 'LOW'],
            ['name' => 'platform.branch.create', 'criticality' => 'MED'],
            ['name' => 'platform.branch.update', 'criticality' => 'MED'],
            ['name' => 'platform.branch.delete', 'criticality' => 'HIGH'],
        ];

        foreach ($permissions as $perm) {
            $permission = Permission::firstOrNew(
                ['name' => $perm['name'], 'guard_name' => 'web']
            );

            if (Schema::hasColumn('permissions', 'group_id')) {
                $permission->group_id = $group->id;
            }
            if (Schema::hasColumn('permissions', 'criticality')) {
                $permission->criticality = $perm['criticality'];
            }

            $permission->save();
        }

        // Assign to roles
        $allPermNames = array_column($permissions, 'name');

        $roleAssignments = [
            'super_admin' => $allPermNames,
            'admin'       => $allPermNames,
            'gerente'     => [
                'platform.tenant.view',
                'platform.branch.view',
                'platform.branch.create',
                'platform.branch.update',
            ],
        ];

        foreach ($roleAssignments as $roleName => $perms) {
            $role = Role::where('name', $roleName)->first();
            if ($role) {
                $role->givePermissionTo($perms);
            }
        }
    }

    public function down(): void
    {
        $permNames = [
            'platform.tenant.view', 'platform.tenant.create',
            'platform.tenant.update', 'platform.tenant.delete',
            'platform.branch.view', 'platform.branch.create',
            'platform.branch.update', 'platform.branch.delete',
        ];

        $permIds = DB::table('permissions')
            ->whereIn('name', $permNames)
            ->pluck('id');

        DB::table('role_has_permissions')->whereIn('permission_id', $permIds)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $permIds)->delete();
        DB::table('permissions')->whereIn('id', $permIds)->delete();

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
