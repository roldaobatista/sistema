<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Ensure Finance group exists
        $financeGroupId = DB::table('permission_groups')->where('name', 'Finance')->value('id');
        if (!$financeGroupId) {
            $financeGroupId = DB::table('permission_groups')->insertGetId([
                'name' => 'Finance',
                'order' => 6,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $perms = [
            ['name' => 'financial.bank_account.view', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'LOW'],
            ['name' => 'financial.bank_account.create', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'MED'],
            ['name' => 'financial.bank_account.update', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'MED'],
            ['name' => 'financial.bank_account.delete', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'HIGH'],
            ['name' => 'financial.fund_transfer.view', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'LOW'],
            ['name' => 'financial.fund_transfer.create', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'HIGH'],
            ['name' => 'financial.fund_transfer.cancel', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'HIGH'],
        ];

        foreach ($perms as $permData) {
            $permission = Permission::firstOrNew(
                ['name' => $permData['name'], 'guard_name' => $permData['guard_name']]
            );

            if (Schema::hasColumn('permissions', 'group_id')) {
                $permission->group_id = $permData['group_id'];
            }
            if (Schema::hasColumn('permissions', 'criticality')) {
                $permission->criticality = $permData['criticality'];
            }

            $permission->save();
        }

        $roleNames = ['super_admin', 'admin', 'financeiro'];
        $permissionNames = array_column($perms, 'name');

        foreach ($roleNames as $roleName) {
            $role = Role::where('name', $roleName)->first();
            if ($role) {
                // Give permissions one by one to avoid potential array issues with some DB drivers or library versions
                foreach ($permissionNames as $permName) {
                    if (!$role->hasPermissionTo($permName)) {
                        $role->givePermissionTo($permName);
                    }
                }
            }
        }
    }

    public function down(): void
    {
        $permNames = [
            'financial.bank_account.view',
            'financial.bank_account.create',
            'financial.bank_account.update',
            'financial.bank_account.delete',
            'financial.fund_transfer.view',
            'financial.fund_transfer.create',
            'financial.fund_transfer.cancel',
        ];

        foreach ($permNames as $permName) {
            Permission::where('name', $permName)->delete();
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
