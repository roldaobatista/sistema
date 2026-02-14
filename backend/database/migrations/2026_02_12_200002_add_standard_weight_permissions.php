<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    private array $permissionNames = [
        'equipments.standard_weight.view',
        'equipments.standard_weight.create',
        'equipments.standard_weight.update',
        'equipments.standard_weight.delete',
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach ($this->permissionNames as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $roleAssignments = [
            'admin'       => $this->permissionNames,
            'gerencial'   => $this->permissionNames,
            'gerente'     => $this->permissionNames,
            'operacional' => [
                'equipments.standard_weight.view',
                'equipments.standard_weight.create',
                'equipments.standard_weight.update',
            ],
            'tecnico'     => [
                'equipments.standard_weight.view',
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
        $permIds = DB::table('permissions')
            ->whereIn('name', $this->permissionNames)
            ->pluck('id');

        DB::table('role_has_permissions')->whereIn('permission_id', $permIds)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $permIds)->delete();
        DB::table('permissions')->whereIn('id', $permIds)->delete();

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
