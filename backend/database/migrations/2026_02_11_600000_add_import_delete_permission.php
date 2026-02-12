<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    public function up(): void
    {
        $group = \App\Models\PermissionGroup::where('name', 'Import')->first();

        Permission::firstOrCreate(
            ['name' => 'import.data.delete', 'guard_name' => 'web'],
            [
                'group_id' => $group?->id,
                'criticality' => 'HIGH',
            ]
        );

        // Assign to admin and gerente roles
        foreach (['admin', 'gerente'] as $roleName) {
            $role = \Spatie\Permission\Models\Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if ($role && !$role->hasPermissionTo('import.data.delete')) {
                $role->givePermissionTo('import.data.delete');
            }
        }

        // super_admin gets all
        $superAdmin = \Spatie\Permission\Models\Role::where('name', 'super_admin')->where('guard_name', 'web')->first();
        if ($superAdmin) {
            $superAdmin->syncPermissions(Permission::all());
        }
    }

    public function down(): void
    {
        Permission::where('name', 'import.data.delete')->delete();
    }
};
