<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('permissions') || !Schema::hasTable('roles')) {
            return;
        }

        Permission::query()->firstOrCreate(
            ['name' => 'central.manage.rules', 'guard_name' => 'web'],
            ['criticality' => 'HIGH']
        );

        $permission = Permission::query()
            ->where('name', 'central.manage.rules')
            ->where('guard_name', 'web')
            ->first();

        if (!$permission) {
            return;
        }

        $roles = Role::query()
            ->where('guard_name', 'web')
            ->whereIn('name', ['gerente', 'financeiro'])
            ->get();

        foreach ($roles as $role) {
            $role->givePermissionTo($permission);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('roles') || !Schema::hasTable('permissions')) {
            return;
        }

        $permission = Permission::query()
            ->where('name', 'central.manage.rules')
            ->where('guard_name', 'web')
            ->first();

        if (!$permission) {
            return;
        }

        $roles = Role::query()
            ->where('guard_name', 'web')
            ->whereIn('name', ['gerente', 'financeiro'])
            ->get();

        foreach ($roles as $role) {
            $role->revokePermissionTo($permission);
        }
    }
};
