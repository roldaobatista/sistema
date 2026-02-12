<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        $group = \DB::table('permission_groups')->where('slug', 'reports')->first();
        $groupId = $group?->id;

        if (!$groupId) {
            $groupId = \DB::table('permission_groups')->insertGetId([
                'name' => 'Reports',
                'slug' => 'reports',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach (['view', 'export'] as $action) {
            Permission::firstOrCreate([
                'name' => "reports.customers_report.{$action}",
                'guard_name' => 'web',
            ], [
                'group_id' => $groupId,
                'criticality' => 'LOW',
            ]);
        }

        $permissions = Permission::whereIn('name', [
            'reports.customers_report.view',
            'reports.customers_report.export',
        ])->get();

        $roles = ['admin', 'manager', 'seller', 'financeiro'];

        foreach ($roles as $roleName) {
            /** @var \Spatie\Permission\Models\Role|null $role */
            $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
            $role?->givePermissionTo($permissions);
        }
    }

    public function down(): void
    {
        Permission::whereIn('name', [
            'reports.customers_report.view',
            'reports.customers_report.export',
        ])->delete();
    }
};
