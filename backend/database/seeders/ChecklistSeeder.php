<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class ChecklistSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $permissions = [
            'technicians.checklist.view',
            'technicians.checklist.manage',
            'technicians.checklist.create',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        // Assign to Admin
        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $adminRole->givePermissionTo($permissions);

        // Assign to Technician (view and create submissions only)
        $techRole = Role::firstOrCreate(['name' => 'tecnico', 'guard_name' => 'web']);
        $techRole->givePermissionTo([
            'technicians.checklist.view',
            'technicians.checklist.create',
        ]);
    }
}
