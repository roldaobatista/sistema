<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $guard = 'web';
        $now = now();

        $permissions = [
            ['name' => 'estoque.movement.view', 'guard_name' => $guard, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'estoque.movement.create', 'guard_name' => $guard, 'created_at' => $now, 'updated_at' => $now],
        ];

        foreach ($permissions as $perm) {
            DB::table('permissions')->insertOrIgnore($perm);

            if (Schema::hasColumn('permissions', 'group_id')) {
                DB::table('permissions')->where('name', $perm['name'])->whereNull('group_id')->update(['group_id' => null]);
            }
            if (Schema::hasColumn('permissions', 'criticality')) {
                DB::table('permissions')->where('name', $perm['name'])->whereNull('criticality')->update(['criticality' => 'medium']);
            }
        }

        // Assign to admin roles
        $allPermNames = array_column($permissions, 'name');
        $permIds = DB::table('permissions')->whereIn('name', $allPermNames)->pluck('id');

        foreach (['super_admin', 'admin', 'manager'] as $roleName) {
            $role = DB::table('roles')->where('name', $roleName)->where('guard_name', $guard)->first();
            if (!$role) continue;

            foreach ($permIds as $permId) {
                DB::table('role_has_permissions')->insertOrIgnore([
                    'permission_id' => $permId,
                    'role_id' => $role->id,
                ]);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        $permNames = ['estoque.movement.view', 'estoque.movement.create'];

        $permIds = DB::table('permissions')->whereIn('name', $permNames)->pluck('id');
        DB::table('role_has_permissions')->whereIn('permission_id', $permIds)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $permIds)->delete();
        DB::table('permissions')->whereIn('id', $permIds)->delete();

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
