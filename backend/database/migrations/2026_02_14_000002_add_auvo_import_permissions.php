<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration {
    public function up(): void
    {
        $permissions = [
            'auvo.import.view',
            'auvo.import.manage',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(
                ['name' => $perm, 'guard_name' => 'web']
            );
        }

        // Assign to super_admin and admin roles
        foreach (['super_admin', 'admin'] as $roleName) {
            $role = Role::where('name', $roleName)->first();
            if ($role) {
                foreach ($permissions as $perm) {
                    if (!$role->hasPermissionTo($perm)) {
                        $role->givePermissionTo($perm);
                    }
                }
            }
        }
    }

    public function down(): void
    {
        $permissions = [
            'auvo.import.view',
            'auvo.import.manage',
        ];

        foreach ($permissions as $perm) {
            Permission::where('name', $perm)->delete();
        }
    }
};
