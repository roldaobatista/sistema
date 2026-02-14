<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 200 Features Batch 3: Permissions for all new modules.
 */
return new class extends Migration
{
    private array $permissions = [
        // Fleet
        'fleet.vehicle.view', 'fleet.vehicle.create', 'fleet.vehicle.update', 'fleet.vehicle.delete',
        'fleet.inspection.view', 'fleet.inspection.create',
        'fleet.fine.view', 'fleet.fine.create', 'fleet.fine.update',
        // HR
        'hr.schedule.view', 'hr.schedule.manage',
        'hr.clock.view', 'hr.clock.manage',
        'hr.training.view', 'hr.training.manage',
        'hr.performance.view', 'hr.performance.manage',
        // Quality
        'quality.procedure.view', 'quality.procedure.manage',
        'quality.corrective_action.view', 'quality.corrective_action.manage',
        'quality.complaint.view', 'quality.complaint.manage',
        'quality.dashboard.view',
        // NPS / Satisfaction
        'customer.satisfaction.view', 'customer.satisfaction.manage',
        'customer.nps.view',
        'customer.document.view', 'customer.document.manage',
        // Routes
        'route.plan.view', 'route.plan.manage',
        // Automation
        'automation.rule.view', 'automation.rule.manage',
        'automation.webhook.view', 'automation.webhook.manage',
        // Follow-ups
        'commercial.followup.view', 'commercial.followup.manage',
        // Collection
        'finance.collection.view', 'finance.collection.manage',
        // Cost Center
        'finance.cost_center.view', 'finance.cost_center.manage',
        // Price Tables
        'commercial.price_table.view', 'commercial.price_table.manage',
        // Ratings
        'os.work_order.rating.view',
        // Tool Inventory
        'fleet.tool_inventory.view', 'fleet.tool_inventory.manage',
        // Scheduled Reports
        'reports.scheduled.view', 'reports.scheduled.manage',
        // Advanced OS features
        'os.work_order.pause',
        'os.work_order.geolocation.view',
        'os.work_order.profitability.view',
        // Advanced Dashboard
        'dashboard.advanced.view',
        'dashboard.multi_tenant.view',
        'dashboard.productivity.view',
        // Certificate batch
        'equipments.certificate.batch_generate',
        'equipments.certificate.online_verify',
        // DRE / Projections
        'finance.dre.generate',
        'finance.cashflow_projection.view',
        'finance.aging.view',
    ];

    public function up(): void
    {
        $guard = 'web';
        $now = now();

        // Group permissions by module
        $groups = [
            'fleet' => 'Frota & Veículos',
            'hr' => 'RH & Equipe',
            'quality' => 'Qualidade',
            'customer' => 'CRM Avançado',
            'route' => 'Rotas & Otimização',
            'automation' => 'Automação',
            'commercial' => 'Comercial Avançado',
            'finance' => 'Financeiro Avançado',
            'os' => 'OS Avançado',
            'dashboard' => 'Dashboard Avançado',
            'equipments' => 'Certificados Avançados',
            'reports' => 'Relatórios Avançados',
        ];

        // Create permission groups
        foreach ($groups as $prefix => $label) {
            DB::table('permission_groups')->insertOrIgnore([
                'name' => $label,
                'slug' => $prefix,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Create permissions
        foreach ($this->permissions as $perm) {
            DB::table('permissions')->insertOrIgnore([
                'name' => $perm,
                'guard_name' => $guard,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Auto-assign all new permissions to super_admin role
        $superAdminRole = DB::table('roles')->where('name', 'super_admin')->first();
        if ($superAdminRole) {
            $permIds = DB::table('permissions')
                ->whereIn('name', $this->permissions)
                ->pluck('id');

            foreach ($permIds as $permId) {
                DB::table('role_has_permissions')->insertOrIgnore([
                    'permission_id' => $permId,
                    'role_id' => $superAdminRole->id,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('permissions')->whereIn('name', $this->permissions)->delete();
    }
};
