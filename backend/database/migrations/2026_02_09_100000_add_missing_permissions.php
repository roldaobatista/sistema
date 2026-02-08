<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    public function up(): void
    {
        $newModules = [
            'quotes' => [
                'quote' => ['view', 'create', 'update', 'delete', 'approve', 'send'],
            ],
            'service_calls' => [
                'service_call' => ['view', 'create', 'update', 'delete', 'assign'],
            ],
            'equipments' => [
                'equipment' => ['view', 'create', 'update', 'delete'],
            ],
            'import' => [
                'data' => ['view', 'execute'],
            ],
            'crm' => [
                'deal' => ['view', 'create', 'update', 'delete'],
                'pipeline' => ['view', 'create', 'update'],
                'message' => ['view', 'send'],
            ],
        ];

        // Get or create permission groups
        foreach ($newModules as $module => $resources) {
            $group = \App\Models\PermissionGroup::firstOrCreate(
                ['name' => ucfirst(str_replace('_', ' ', $module))],
                ['order' => 100]
            );

            foreach ($resources as $resource => $actions) {
                foreach ($actions as $action) {
                    Permission::firstOrCreate(
                        ['name' => "{$module}.{$resource}.{$action}", 'guard_name' => 'web'],
                        [
                            'group_id' => $group->id,
                            'criticality' => in_array($action, ['delete', 'manage', 'approve']) ? 'HIGH' :
                                (in_array($action, ['create', 'update']) ? 'MED' : 'LOW'),
                        ]
                    );
                }
            }
        }

        // Assign new permissions to existing roles
        $this->assignToRoles();
    }

    private function assignToRoles(): void
    {
        $rolePermissions = [
            'admin' => [
                'quotes.quote.view', 'quotes.quote.create', 'quotes.quote.update', 'quotes.quote.delete', 'quotes.quote.approve', 'quotes.quote.send',
                'service_calls.service_call.view', 'service_calls.service_call.create', 'service_calls.service_call.update', 'service_calls.service_call.delete', 'service_calls.service_call.assign',
                'equipments.equipment.view', 'equipments.equipment.create', 'equipments.equipment.update', 'equipments.equipment.delete',
                'import.data.view', 'import.data.execute',
                'crm.deal.view', 'crm.deal.create', 'crm.deal.update', 'crm.deal.delete',
                'crm.pipeline.view', 'crm.pipeline.create', 'crm.pipeline.update',
                'crm.message.view', 'crm.message.send',
            ],
            'gerente' => [
                'quotes.quote.view', 'quotes.quote.create', 'quotes.quote.update', 'quotes.quote.approve', 'quotes.quote.send',
                'service_calls.service_call.view', 'service_calls.service_call.create', 'service_calls.service_call.update', 'service_calls.service_call.assign',
                'equipments.equipment.view', 'equipments.equipment.create', 'equipments.equipment.update',
                'import.data.view', 'import.data.execute',
                'crm.deal.view', 'crm.deal.create', 'crm.deal.update',
                'crm.pipeline.view',
                'crm.message.view', 'crm.message.send',
            ],
            'tecnico' => [
                'service_calls.service_call.view', 'service_calls.service_call.update',
                'equipments.equipment.view',
            ],
            'atendente' => [
                'quotes.quote.view', 'quotes.quote.create', 'quotes.quote.send',
                'service_calls.service_call.view', 'service_calls.service_call.create', 'service_calls.service_call.update',
                'equipments.equipment.view',
            ],
            'vendedor' => [
                'quotes.quote.view', 'quotes.quote.create', 'quotes.quote.update', 'quotes.quote.send',
                'service_calls.service_call.view', 'service_calls.service_call.create',
                'equipments.equipment.view',
                'crm.deal.view', 'crm.deal.create', 'crm.deal.update',
                'crm.pipeline.view',
                'crm.message.view', 'crm.message.send',
            ],
            'financeiro' => [
                'quotes.quote.view',
                'equipments.equipment.view',
            ],
        ];

        foreach ($rolePermissions as $roleName => $permissions) {
            $role = \Spatie\Permission\Models\Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if ($role) {
                foreach ($permissions as $perm) {
                    $permission = Permission::findByName($perm, 'web');
                    if ($permission && !$role->hasPermissionTo($perm)) {
                        $role->givePermissionTo($permission);
                    }
                }
            }
        }

        // super_admin gets all permissions
        $superAdmin = \Spatie\Permission\Models\Role::where('name', 'super_admin')->where('guard_name', 'web')->first();
        if ($superAdmin) {
            $superAdmin->syncPermissions(Permission::all());
        }
    }

    public function down(): void
    {
        $prefixes = ['quotes.', 'service_calls.', 'equipments.', 'import.', 'crm.'];
        Permission::where(function ($q) use ($prefixes) {
            foreach ($prefixes as $prefix) {
                $q->orWhere('name', 'like', "{$prefix}%");
            }
        })->delete();
    }
};
