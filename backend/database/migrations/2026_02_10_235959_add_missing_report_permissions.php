<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use App\Models\PermissionGroup;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Garante que o cache de permissões seja limpo
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $group = PermissionGroup::where('name', 'Reports')->first();
        
        // Se o grupo não existir (banco vazio?), cria ou busca por outro meio, 
        // mas assumindo que o seeder base já rodou, deve existir.
        if (!$group) {
            return;
        }

        $resources = [
            'quotes_report',
            'service_calls_report',
            'crm_report',
            'equipments_report',
            'suppliers_report',
            'stock_report',
        ];

        $actions = ['view', 'export'];

        // Criar permissões
        foreach ($resources as $resource) {
            foreach ($actions as $action) {
                Permission::firstOrCreate([
                    'name' => "reports.{$resource}.{$action}",
                    'guard_name' => 'web',
                ], [
                    'group_id' => $group->id,
                    'criticality' => 'LOW',
                ]);
            }
        }

        // Atribuir aos Roles
        $admin = Role::where('name', 'admin')->first();
        $manager = Role::where('name', 'gerente')->first();
        $seller = Role::where('name', 'vendedor')->first();

        $allNewPermissions = [];
        foreach ($resources as $resource) {
            foreach ($actions as $action) {
                $allNewPermissions[] = "reports.{$resource}.{$action}";
            }
        }

        if ($admin) {
            $admin->givePermissionTo($allNewPermissions);
        }

        if ($manager) {
            $manager->givePermissionTo($allNewPermissions);
        }

        if ($seller) {
            // Vendedor vê apenas quotes e reports básicos (já tinha os_report)
            // Vamos dar quotes e crm
            $sellerPermissions = [
                'reports.quotes_report.view', 'reports.quotes_report.export',
                'reports.crm_report.view', 'reports.crm_report.export',
            ];
            $seller->givePermissionTo($sellerPermissions);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $resources = [
            'quotes_report',
            'service_calls_report',
            'crm_report',
            'equipments_report',
            'suppliers_report',
            'stock_report',
        ];

        $actions = ['view', 'export'];

        foreach ($resources as $resource) {
            foreach ($actions as $action) {
                Permission::where('name', "reports.{$resource}.{$action}")->delete();
            }
        }
        
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
