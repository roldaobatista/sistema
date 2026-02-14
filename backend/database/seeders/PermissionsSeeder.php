<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionsSeeder extends Seeder
{
    /**
     * Seed de TODAS as permissões usadas nas rotas da API.
     * Extraído automaticamente de routes/api.php
     */
    public function run(): void
    {
        $permissions = [
            // AI & Analytics
            'ai.analytics',

            // Automation
            'automation.rule',
            'automation.webhook',

            // Auvo
            'auvo.export',
            'auvo.import',

            // Cadastros
            'cadastros.customer',
            'cadastros.product',
            'cadastros.service',
            'cadastros.supplier',

            // Central de Atendimento
            'central.assign',
            'central.close',
            'central.create',
            'central.item',
            'central.manage',

            // Comercial
            'comercial.view',
            'commercial.followup',
            'commercial.price_table',

            // Comissões
            'commissions.campaign',
            'commissions.dispute',
            'commissions.goal',
            'commissions.recurring',
            'commissions.rule',
            'commissions.settlement',

            // CRM
            'crm.deal',
            'crm.message',
            'crm.pipeline',
            'crm.view',

            // Customer
            'customer.document',
            'customer.nps',
            'customer.satisfaction',

            // Email
            'email.account',
            'email.inbox',
            'email.rule',
            'email.signature',
            'email.tag',
            'email.template',

            // Equipamentos
            'equipments.equipment',
            'equipments.standard_weight',

            // Estoque
            'estoque.manage',
            'estoque.movement',
            'estoque.view',
            'estoque.warehouse',

            // Despesas
            'expenses.expense',
            'expenses.fueling_log',

            // Financeiro
            'finance.cashflow',
            'finance.chart',
            'finance.cost_center',
            'finance.dre',
            'finance.payable',
            'finance.receivable',
            'financeiro.approve',
            'financeiro.view',
            'financial.bank_account',
            'financial.fund_transfer',

            // Fiscal
            'fiscal.note',

            // Frota
            'fleet.fine',
            'fleet.inspection',
            'fleet.management',
            'fleet.tool_inventory',
            'fleet.vehicle',

            // RH
            'hr.adjustment',
            'hr.analytics',
            'hr.benefits',
            'hr.clock',
            'hr.dashboard',
            'hr.document',
            'hr.feedback',
            'hr.geofence',
            'hr.holiday',
            'hr.journey',
            'hr.leave',
            'hr.onboarding',
            'hr.organization',
            'hr.performance',
            'hr.recruitment',
            'hr.reports',
            'hr.schedule',
            'hr.skills',
            'hr.training',

            // IAM
            'iam.audit_log',
            'iam.permission',
            'iam.role',
            'iam.user',

            // Importação
            'import.data',

            // INMETRO
            'inmetro.intelligence',

            // Notificações
            'notifications.notification',

            // OS
            'os.work_order',

            // Platform
            'platform.branch',
            'platform.dashboard',
            'platform.settings',
            'platform.tenant',

            // Qualidade
            'qualidade.view',
            'quality.complaint',
            'quality.corrective_action',
            'quality.dashboard',
            'quality.procedure',

            // Orçamentos
            'quotes.quote',

            // Relatórios
            'reports.commission_report',
            'reports.crm_report',
            'reports.customers_report',
            'reports.equipments_report',
            'reports.financial_report',
            'reports.margin_report',
            'reports.os_report',
            'reports.productivity_report',
            'reports.quotes_report',
            'reports.scheduled',
            'reports.service_calls_report',
            'reports.stock_report',
            'reports.suppliers_report',
            'reports.technician_cash_report',

            // Rotas
            'route.plan',

            // Chamados
            'service_calls.service_call',

            // Técnicos
            'technicians.cashbox',
            'technicians.checklist',
            'technicians.schedule',
            'technicians.time_entry',
        ];

        $guard = 'web';

        // Create all permissions
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(
                ['name' => $perm, 'guard_name' => $guard]
            );
        }

        // Assign ALL permissions to super_admin
        $superAdmin = Role::where('name', 'super_admin')->first();
        if ($superAdmin) {
            $superAdmin->syncPermissions(Permission::all());
        }

        // Assign relevant permissions to admin
        $admin = Role::where('name', 'admin')->first();
        if ($admin) {
            $adminPerms = array_filter($permissions, fn($p) =>
                !str_starts_with($p, 'platform.') &&
                $p !== 'iam.permission'
            );
            $admin->syncPermissions($adminPerms);
        }

        $this->command->info('✅ ' . count($permissions) . ' permissões criadas/atualizadas');
        $this->command->info('✅ super_admin recebeu TODAS as permissões');
    }
}
