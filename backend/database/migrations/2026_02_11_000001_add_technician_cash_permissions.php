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
        // Limpar cache de permissões
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Criar grupo se não existir (apenas por segurança)
        $financeGroupId = DB::table('permission_groups')->where('name', 'Finance')->value('id');
        
        // Criar permissões view e manage
        $perms = [
            ['name' => 'technicians.cashbox.view', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'LOW'],
            ['name' => 'technicians.cashbox.manage', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'LOW'],
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

        // Atribuir aos roles SuperAdmin e Admin
        $roleNames = ['super_admin', 'admin'];
        $permissions = ['technicians.cashbox.view', 'technicians.cashbox.manage'];

        foreach ($roleNames as $roleName) {
            $role = Role::where('name', $roleName)->first();
            if ($role) {
                $role->givePermissionTo($permissions);
            }
        }
    }

    public function down(): void
    {
        foreach (['technicians.cashbox.view', 'technicians.cashbox.manage'] as $permName) {
            Permission::where('name', $permName)->delete();
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
