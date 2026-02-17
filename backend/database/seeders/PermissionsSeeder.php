<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class PermissionsSeeder extends Seeder
{
    /**
     * Seed de TODAS as permissões granulares usadas nas rotas da API e no frontend.
     * Extraído de routes/api.php + frontend/src/App.tsx (routePermissionRules)
     */
    public function run(): void
    {
        $permissions = [
            // ─── AI & Analytics ───
            'ai.analytics.view',

            // ─── Admin / Settings ───
            'admin.settings.update',
            'admin.settings.view',

            // ─── Automation ───
            'automation.rule.manage',
            'automation.rule.view',
            'automation.webhook.manage',
            'automation.webhook.view',

            // ─── Auvo ───
            'auvo.export.execute',
            'auvo.import.delete',
            'auvo.import.execute',
            'auvo.import.view',

            // ─── Cadastros ───
            'cadastros.customer.create',
            'cadastros.customer.delete',
            'cadastros.customer.update',
            'cadastros.customer.view',
            'cadastros.product.create',
            'cadastros.product.delete',
            'cadastros.product.update',
            'cadastros.product.view',
            'cadastros.service.create',
            'cadastros.service.delete',
            'cadastros.service.update',
            'cadastros.service.view',
            'cadastros.supplier.create',
            'cadastros.supplier.delete',
            'cadastros.supplier.update',
            'cadastros.supplier.view',

            // ─── Catálogo de Serviços (público) ───
            'catalog.view',
            'catalog.manage',

            // ─── Central de Atendimento ───
            'central.assign',
            'central.close.self',
            'central.create.task',
            'central.item.view',
            'central.manage.kpis',
            'central.manage.rules',

            // ─── Chamados (Service Calls) ───
            'chamados.service_call.assign',
            'chamados.service_call.create',
            'chamados.service_call.delete',
            'chamados.service_call.update',
            'chamados.service_call.view',
            'service_calls.service_call.assign',
            'service_calls.service_call.create',
            'service_calls.service_call.delete',
            'service_calls.service_call.update',
            'service_calls.service_call.view',

            // ─── Comercial ───
            'comercial.view',
            'commercial.followup.manage',
            'commercial.followup.view',
            'commercial.price_table.manage',
            'commercial.price_table.view',

            // ─── Comissões ───
            'commissions.campaign.create',
            'commissions.campaign.delete',
            'commissions.campaign.update',
            'commissions.campaign.view',
            'commissions.dispute.create',
            'commissions.dispute.resolve',
            'commissions.dispute.view',
            'commissions.goal.create',
            'commissions.goal.delete',
            'commissions.goal.update',
            'commissions.goal.view',
            'commissions.recurring.create',
            'commissions.recurring.delete',
            'commissions.recurring.update',
            'commissions.recurring.view',
            'commissions.rule.create',
            'commissions.rule.delete',
            'commissions.rule.update',
            'commissions.rule.view',
            'commissions.settlement.approve',
            'commissions.settlement.create',

            // ─── CRM ───
            'crm.deal.create',
            'crm.deal.delete',
            'crm.deal.update',
            'crm.deal.view',
            'crm.forecast.view',
            'crm.form.manage',
            'crm.form.view',
            'crm.goal.manage',
            'crm.goal.view',
            'crm.message.send',
            'crm.message.view',
            'crm.pipeline.create',
            'crm.pipeline.delete',
            'crm.pipeline.update',
            'crm.pipeline.view',
            'crm.proposal.manage',
            'crm.proposal.view',
            'crm.referral.manage',
            'crm.referral.view',
            'crm.renewal.manage',
            'crm.renewal.view',
            'crm.scoring.manage',
            'crm.scoring.view',
            'crm.sequence.manage',
            'crm.sequence.view',
            'crm.territory.manage',
            'crm.territory.view',
            'crm.view',

            // ─── Customer ───
            'customer.document.manage',
            'customer.document.view',
            'customer.nps.view',
            'customer.satisfaction.manage',
            'customer.satisfaction.view',

            // ─── Email ───
            'email.account.create',
            'email.account.delete',
            'email.account.sync',
            'email.account.update',
            'email.account.view',
            'email.inbox.create_task',
            'email.inbox.manage',
            'email.inbox.send',
            'email.inbox.view',
            'email.rule.create',
            'email.rule.delete',
            'email.rule.update',
            'email.rule.view',
            'email.signature.manage',
            'email.signature.view',
            'email.tag.manage',
            'email.tag.view',
            'email.template.create',
            'email.template.delete',
            'email.template.update',
            'email.template.view',

            // ─── Equipamentos ───
            'equipamentos.equipment.view',
            'equipments.equipment.create',
            'equipments.equipment.delete',
            'equipments.equipment.update',
            'equipments.equipment.view',
            'equipments.standard_weight.create',
            'equipments.standard_weight.delete',
            'equipments.standard_weight.update',
            'equipments.standard_weight.view',
            'equipments.equipment_model.view',
            'equipments.equipment_model.create',
            'equipments.equipment_model.update',
            'equipments.equipment_model.delete',

            // ─── Estoque ───
            'estoque.manage',
            'estoque.movement.create',
            'estoque.movement.view',
            'estoque.view',
            'estoque.warehouse.view',
            'estoque.warehouse.create',
            'estoque.warehouse.update',
            'estoque.warehouse.delete',
            'estoque.transfer.create',
            'estoque.transfer.accept',
            'estoque.used_stock.view',
            'estoque.used_stock.report',
            'estoque.used_stock.confirm',
            'estoque.warranty.view',
            'estoque.label.print',
            'estoque.serial.view',
            'estoque.serial.create',
            'estoque.rma.view',
            'estoque.rma.create',
            'estoque.disposal.view',
            'estoque.disposal.create',
            'estoque.intelligence.view',
            'estoque.kardex.view',
            'estoque.inventory.view',
            'estoque.inventory.create',
            'estoque.inventory.execute',

            // ─── Despesas / Abastecimento ───
            'expenses.expense.approve',
            'expenses.expense.create',
            'expenses.expense.delete',
            'expenses.expense.review',
            'expenses.expense.update',
            'expenses.expense.view',
            'expenses.fueling_log.approve',
            'expenses.fueling_log.create',
            'expenses.fueling_log.delete',
            'expenses.fueling_log.update',
            'expenses.fueling_log.view',

            // ─── Financeiro ───
            'finance.cashflow.view',
            'finance.chart.create',
            'finance.chart.delete',
            'finance.chart.update',
            'finance.chart.view',
            'finance.cost_center.view',
            'finance.dre.view',
            'finance.payable.create',
            'finance.payable.delete',
            'finance.payable.settle',
            'finance.payable.update',
            'finance.payable.view',
            'finance.receivable.create',
            'finance.receivable.delete',
            'finance.receivable.settle',
            'finance.receivable.update',
            'finance.receivable.view',
            'financeiro.accounts_receivable.update',
            'financeiro.approve',
            'financeiro.view',
            'financial.bank_account.create',
            'financial.bank_account.delete',
            'financial.bank_account.update',
            'financial.bank_account.view',
            'financial.fund_transfer.cancel',
            'financial.fund_transfer.create',
            'financial.fund_transfer.view',

            // ─── Fiscal ───
            'fiscal.note.cancel',
            'fiscal.note.create',
            'fiscal.note.view',

            // ─── Frota ───
            'fleet.fine.create',
            'fleet.fine.update',
            'fleet.fine.view',
            'fleet.inspection.create',
            'fleet.management',
            'fleet.tool_inventory.manage',
            'fleet.tool_inventory.view',
            'fleet.vehicle.create',
            'fleet.vehicle.delete',
            'fleet.vehicle.update',
            'fleet.vehicle.view',
            'fleet.view',

            // ─── RH ───
            'hr.adjustment.approve',
            'hr.adjustment.create',
            'hr.adjustment.view',
            'hr.analytics.view',
            'hr.benefits.manage',
            'hr.benefits.view',
            'hr.clock.approve',
            'hr.clock.manage',
            'hr.clock.view',
            'hr.dashboard.view',
            'hr.document.manage',
            'hr.document.view',
            'hr.feedback.create',
            'hr.feedback.view',
            'hr.geofence.manage',
            'hr.geofence.view',
            'hr.holiday.manage',
            'hr.holiday.view',
            'hr.journey.manage',
            'hr.journey.view',
            'hr.leave.approve',
            'hr.leave.create',
            'hr.leave.view',
            'hr.onboarding.manage',
            'hr.onboarding.view',
            'hr.organization.manage',
            'hr.organization.view',
            'hr.performance.manage',
            'hr.performance.view',
            'hr.recruitment.manage',
            'hr.recruitment.view',
            'hr.reports.view',
            'hr.schedule.manage',
            'hr.schedule.view',
            'hr.skills.manage',
            'hr.skills.view',
            'hr.training.manage',
            'hr.training.view',

            // ─── IAM ───
            'iam.audit_log.export',
            'iam.audit_log.view',
            'iam.permission.manage',
            'iam.role.create',
            'iam.role.delete',
            'iam.role.update',
            'iam.role.view',
            'iam.user.create',
            'iam.user.delete',
            'iam.user.export',
            'iam.user.update',
            'iam.user.view',

            // ─── Importação ───
            'import.data.delete',
            'import.data.execute',
            'import.data.view',

            // ─── INMETRO ───
            'inmetro.intelligence.convert',
            'inmetro.intelligence.enrich',
            'inmetro.intelligence.import',
            'inmetro.intelligence.view',
            'inmetro.view',

            // ─── Notificações ───
            'notifications.notification.update',
            'notifications.notification.view',

            // ─── Ordens de Serviço ───
            'os.work_order.authorize_dispatch',
            'os.work_order.change_status',
            'os.work_order.create',
            'os.work_order.delete',
            'os.work_order.export',
            'os.work_order.rating.view',
            'os.work_order.update',
            'os.work_order.view',

            // ─── Platform ───
            'platform.branch.create',
            'platform.branch.delete',
            'platform.branch.update',
            'platform.branch.view',
            'platform.dashboard.view',
            'platform.settings.manage',
            'platform.settings.view',
            'platform.tenant.create',
            'platform.tenant.delete',
            'platform.tenant.update',
            'platform.tenant.view',

            // ─── TV Dashboard ───
            'tv.dashboard.view',
            'tv.camera.manage',

            // ─── Portal ───
            'portal.view',

            // ─── Qualidade ───
            'qualidade.view',
            'quality.complaint.manage',
            'quality.complaint.view',
            'quality.corrective_action.manage',
            'quality.corrective_action.view',
            'quality.dashboard.view',
            'quality.procedure.manage',
            'quality.procedure.view',
            'quality.procedure.create',
            'quality.procedure.update',
            'quality.audit.view',
            'quality.audit.create',
            'quality.audit.update',
            'quality.document.view',
            'quality.document.create',
            'quality.document.approve',
            'quality.management_review.view',
            'quality.management_review.create',
            'quality.management_review.update',

            // ─── 75 Features — Permissões novas ───
            'equipamentos.calibration.view',
            'equipamentos.calibration.create',
            'equipamentos.calibration.update',
            'equipamentos.standard_weight.view',
            'equipamentos.standard_weight.create',
            'equipamentos.standard_weight.update',
            'equipamentos.equipment.update',
            'whatsapp.config.view',
            'whatsapp.config.manage',
            'whatsapp.log.view',
            'whatsapp.send',
            'alerts.alert.view',
            'alerts.view',
            'alerts.manage',
            'alerts.configure',
            'finance.renegotiation.view',
            'financeiro.renegotiation.view',
            'financeiro.renegotiation.create',
            'financeiro.renegotiation.approve',
            'financeiro.receipt.generate',
            'financeiro.collection.manage',
            'calibration.weight_assignment.view',
            'calibration.reading.view',
            'calibration.tool.view',
            'weight.assignment.view',
            'weight.assignment.manage',
            'tool.calibration.view',
            'tool.calibration.manage',

            // ─── Orçamentos ───
            'quotes.quote.apply_discount',
            'quotes.quote.approve',
            'quotes.quote.convert',
            'quotes.quote.create',
            'quotes.quote.delete',
            'quotes.quote.internal_approve',
            'quotes.quote.send',
            'quotes.quote.update',
            'quotes.quote.view',

            // ─── Relatórios ───  (relatorios.report.view removida — permissão órfã sem uso)
            'reports.commission_report.export',
            'reports.commission_report.view',
            'reports.crm_report.export',
            'reports.crm_report.view',
            'reports.customers_report.export',
            'reports.customers_report.view',
            'reports.equipments_report.export',
            'reports.equipments_report.view',
            'reports.financial_report.export',
            'reports.financial_report.view',
            'reports.margin_report.export',
            'reports.margin_report.view',
            'reports.os_report.export',
            'reports.os_report.view',
            'reports.productivity_report.export',
            'reports.productivity_report.view',
            'reports.quotes_report.export',
            'reports.quotes_report.view',
            'reports.scheduled.manage',
            'reports.scheduled.view',
            'reports.service_calls_report.export',
            'reports.service_calls_report.view',
            'reports.stock_report.export',
            'reports.stock_report.view',
            'reports.suppliers_report.export',
            'reports.suppliers_report.view',
            'reports.technician_cash_report.export',
            'reports.technician_cash_report.view',

            // ─── Rotas ───
            'route.plan.view',

            // ─── Técnicos ───
            'technicians.cashbox.manage',
            'technicians.cashbox.view',
            'technicians.checklist.create',
            'technicians.checklist.manage',
            'technicians.checklist.view',
            'technicians.schedule.manage',
            'technicians.schedule.view',
            'technicians.time_entry.create',
            'technicians.time_entry.delete',
            'technicians.time_entry.update',
            'technicians.time_entry.view',

            // ─── Avançado (Frontend route: /avancado) ───
            'advanced.follow_up.view',
        ];

        $guard = 'web';

        $created = 0;
        foreach ($permissions as $perm) {
            $wasCreated = Permission::firstOrCreate(
                ['name' => $perm, 'guard_name' => $guard]
            )->wasRecentlyCreated;

            if ($wasCreated) {
                $created++;
            }
        }

        // ─── Roles do sistema com nomes em português ───

        $roles = [
            ['name' => 'super_admin',       'display_name' => 'Super Administrador',  'description' => 'Acesso total ao sistema, sem restrições.'],
            ['name' => 'admin',             'display_name' => 'Administrador',        'description' => 'Gerencia tudo exceto configurações de plataforma.'],
            ['name' => 'gerente',           'display_name' => 'Gerente',              'description' => 'Gestão operacional e financeira completa.'],
            ['name' => 'coordenador',       'display_name' => 'Coordenador Técnico',  'description' => 'Coordena equipe técnica, agenda e chamados.'],
            ['name' => 'tecnico',           'display_name' => 'Técnico',              'description' => 'Executa ordens de serviço e checklists em campo.'],
            ['name' => 'financeiro',        'display_name' => 'Financeiro',           'description' => 'Contas a pagar/receber, faturamento e conciliação.'],
            ['name' => 'comercial',         'display_name' => 'Comercial / Vendas',   'description' => 'Orçamentos, CRM, pipeline de vendas.'],
            ['name' => 'atendimento',       'display_name' => 'Atendimento',          'description' => 'Central de atendimento, chamados e portal do cliente.'],
            ['name' => 'rh',                'display_name' => 'Recursos Humanos',     'description' => 'Gestão de ponto, jornada, férias e documentos.'],
            ['name' => 'estoquista',        'display_name' => 'Estoquista',           'description' => 'Movimentações de estoque, inventários e armazéns.'],
            ['name' => 'qualidade',         'display_name' => 'Qualidade',            'description' => 'Procedimentos, ações corretivas e NPS.'],
            ['name' => 'visualizador',      'display_name' => 'Visualizador',         'description' => 'Acesso somente leitura a todos os módulos.'],
            ['name' => 'monitor',           'display_name' => 'Monitor',              'description' => 'Acesso ao dashboard TV e câmeras de monitoramento.'],
            ['name' => 'vendedor',          'display_name' => 'Vendedor',             'description' => 'Vendas, orçamentos e prospecção de clientes.'],
            ['name' => 'tecnico_vendedor',  'display_name' => 'Técnico-Vendedor',     'description' => 'Acumula funções de técnico e vendedor com acesso a valores.'],
            ['name' => 'motorista',         'display_name' => 'Motorista',            'description' => 'Operação da UMC, despesas e abastecimento.'],
        ];

        foreach ($roles as $roleData) {
            $role = Role::firstOrCreate(
                ['name' => $roleData['name'], 'guard_name' => $guard],
                ['description' => $roleData['description']]
            );
            $role->update([
                'display_name' => $roleData['display_name'],
                'description' => $roleData['description'],
            ]);
        }

        // ─── Atribuição de permissões por role ───

        $allPerms = Permission::where('guard_name', $guard)->get();

        // super_admin: TUDO
        $superAdmin = Role::where('name', 'super_admin')->first();
        $superAdmin?->syncPermissions($allPerms);

        // admin: tudo exceto platform.tenant.* e iam.permission.manage
        $admin = Role::where('name', 'admin')->first();
        if ($admin) {
            $adminPerms = array_filter($permissions, fn($p) =>
                !str_starts_with($p, 'platform.tenant') &&
                $p !== 'iam.permission.manage'
            );
            $admin->syncPermissions($adminPerms);
        }

        // gerente: quase tudo operacional (sem platform, sem iam.permission.manage)
        $gerente = Role::where('name', 'gerente')->first();
        if ($gerente) {
            $gerentePerms = array_filter($permissions, fn($p) =>
                !str_starts_with($p, 'platform.tenant') &&
                $p !== 'iam.permission.manage' &&
                $p !== 'admin.settings.update'
            );
            $gerente->syncPermissions($gerentePerms);
        }

        // coordenador: OS, chamados, técnicos, equipamentos, agenda
        $coordenador = Role::where('name', 'coordenador')->first();
        if ($coordenador) {
            $coordPerms = array_filter($permissions, fn($p) =>
                str_starts_with($p, 'os.') ||
                str_starts_with($p, 'service_calls.') ||
                str_starts_with($p, 'chamados.') ||
                str_starts_with($p, 'technicians.') ||
                str_starts_with($p, 'equipments.') ||
                str_starts_with($p, 'cadastros.customer.view') ||
                str_starts_with($p, 'cadastros.product.view') ||
                str_starts_with($p, 'cadastros.service.view') ||
                str_starts_with($p, 'catalog.') ||
                str_starts_with($p, 'estoque.movement.view') ||
                str_starts_with($p, 'notifications.') ||
                $p === 'platform.dashboard.view' ||
                $p === 'hr.clock.view' ||
                $p === 'hr.schedule.view'
            );
            $coordenador->syncPermissions($coordPerms);
        }

        // tecnico: execução em campo
        $tecnico = Role::where('name', 'tecnico')->first();
        if ($tecnico) {
            $techPerms = [
                'os.work_order.view',
                'os.work_order.update',
                'os.work_order.change_status',
                'technicians.schedule.view',
                'technicians.time_entry.view',
                'technicians.time_entry.create',
                'technicians.checklist.view',
                'technicians.cashbox.view',
                'service_calls.service_call.view',
                'service_calls.service_call.update',
                'equipments.equipment.view',
                'equipments.equipment_model.view',
                'estoque.view',
                'estoque.movement.view',
                'estoque.transfer.accept',
                'estoque.used_stock.view',
                'estoque.used_stock.report',
                'cadastros.customer.view',
                'cadastros.product.view',
                'cadastros.service.view',
                'catalog.view',
                'notifications.notification.view',
                'notifications.notification.update',
                'hr.clock.view',
                'hr.clock.manage',
            ];
            $tecnico->syncPermissions($techPerms);
        }

        // financeiro: módulos financeiros completos
        $financeiro = Role::where('name', 'financeiro')->first();
        if ($financeiro) {
            $finPerms = array_filter($permissions, fn($p) =>
                str_starts_with($p, 'finance.') ||
                str_starts_with($p, 'financial.') ||
                str_starts_with($p, 'financeiro.') ||
                str_starts_with($p, 'expenses.') ||
                str_starts_with($p, 'commissions.') ||
                str_starts_with($p, 'fiscal.') ||
                str_starts_with($p, 'reports.financial') ||
                str_starts_with($p, 'reports.commission') ||
                str_starts_with($p, 'reports.margin') ||
                str_starts_with($p, 'reports.technician_cash') ||
                $p === 'cadastros.customer.view' ||
                $p === 'cadastros.product.view' ||
                $p === 'cadastros.service.view' ||
                $p === 'cadastros.supplier.view' ||
                $p === 'quotes.quote.view' ||
                $p === 'os.work_order.view' ||
                $p === 'notifications.notification.view' ||
                $p === 'platform.dashboard.view'
            );
            $financeiro->syncPermissions($finPerms);
        }

        // comercial: CRM, orçamentos, clientes
        $comercial = Role::where('name', 'comercial')->first();
        if ($comercial) {
            $comPerms = array_filter($permissions, fn($p) =>
                str_starts_with($p, 'crm.') ||
                str_starts_with($p, 'quotes.') ||
                str_starts_with($p, 'comercial.') ||
                str_starts_with($p, 'commercial.') ||
                str_starts_with($p, 'cadastros.customer.') ||
                str_starts_with($p, 'customer.') ||
                str_starts_with($p, 'cadastros.product.view') ||
                str_starts_with($p, 'cadastros.service.view') ||
                str_starts_with($p, 'catalog.') ||
                str_starts_with($p, 'reports.crm') ||
                str_starts_with($p, 'reports.quotes') ||
                str_starts_with($p, 'reports.customers') ||
                $p === 'os.work_order.view' ||
                $p === 'notifications.notification.view' ||
                $p === 'notifications.notification.update' ||
                $p === 'platform.dashboard.view'
            );
            $comercial->syncPermissions($comPerms);
        }

        // atendimento: central, chamados, portal
        $atendimento = Role::where('name', 'atendimento')->first();
        if ($atendimento) {
            $atendPerms = array_filter($permissions, fn($p) =>
                str_starts_with($p, 'central.') ||
                str_starts_with($p, 'service_calls.') ||
                str_starts_with($p, 'chamados.') ||
                str_starts_with($p, 'portal.') ||
                str_starts_with($p, 'email.inbox.') ||
                $p === 'cadastros.customer.view' ||
                $p === 'cadastros.customer.create' ||
                $p === 'os.work_order.view' ||
                $p === 'quotes.quote.view' ||
                $p === 'notifications.notification.view' ||
                $p === 'notifications.notification.update' ||
                $p === 'platform.dashboard.view'
            );
            $atendimento->syncPermissions($atendPerms);
        }

        // rh: módulo RH completo
        $rh = Role::where('name', 'rh')->first();
        if ($rh) {
            $rhPerms = array_filter($permissions, fn($p) =>
                str_starts_with($p, 'hr.') ||
                $p === 'iam.user.view' ||
                $p === 'notifications.notification.view' ||
                $p === 'platform.dashboard.view'
            );
            $rh->syncPermissions($rhPerms);
        }

        // estoquista: estoque, armazéns, inventários
        $estoquista = Role::where('name', 'estoquista')->first();
        if ($estoquista) {
            $estPerms = array_filter($permissions, fn($p) =>
                str_starts_with($p, 'estoque.') ||
                str_starts_with($p, 'reports.stock') ||
                $p === 'cadastros.product.view' ||
                $p === 'cadastros.supplier.view' ||
                $p === 'notifications.notification.view' ||
                $p === 'platform.dashboard.view'
            );
            $estoquista->syncPermissions($estPerms);
        }

        // qualidade: procedimentos, ações corretivas, NPS
        $qualidade = Role::where('name', 'qualidade')->first();
        if ($qualidade) {
            $qualPerms = array_filter($permissions, fn($p) =>
                str_starts_with($p, 'quality.') ||
                str_starts_with($p, 'qualidade.') ||
                str_starts_with($p, 'customer.nps') ||
                str_starts_with($p, 'customer.satisfaction') ||
                $p === 'os.work_order.view' ||
                $p === 'cadastros.customer.view' ||
                $p === 'equipments.equipment.view' ||
                $p === 'notifications.notification.view' ||
                $p === 'platform.dashboard.view'
            );
            $qualidade->syncPermissions($qualPerms);
        }

        // visualizador: somente leitura
        $visualizador = Role::where('name', 'visualizador')->first();
        if ($visualizador) {
            $viewPerms = array_filter($permissions, fn($p) =>
                str_ends_with($p, '.view')
            );
            $visualizador->syncPermissions($viewPerms);
        }

        // monitor: acesso ao TV dashboard e câmeras
        $monitor = Role::where('name', 'monitor')->first();
        if ($monitor) {
            $monitorPerms = array_filter($permissions, fn($p) =>
                str_starts_with($p, 'tv.') ||
                $p === 'platform.dashboard.view' ||
                $p === 'os.work_order.view' ||
                $p === 'chamados.service_call.view'
            );
            $monitor->syncPermissions($monitorPerms);
        }

        // vendedor: alias do comercial com mesmas permissões
        $vendedor = Role::where('name', 'vendedor')->first();
        if ($vendedor) {
            $vendedorPerms = array_filter($permissions, fn($p) =>
                str_starts_with($p, 'crm.') ||
                str_starts_with($p, 'quotes.') ||
                str_starts_with($p, 'comercial.') ||
                str_starts_with($p, 'commercial.') ||
                str_starts_with($p, 'cadastros.customer.') ||
                str_starts_with($p, 'customer.') ||
                str_starts_with($p, 'cadastros.product.view') ||
                str_starts_with($p, 'cadastros.service.view') ||
                str_starts_with($p, 'catalog.') ||
                str_starts_with($p, 'reports.crm') ||
                str_starts_with($p, 'reports.quotes') ||
                str_starts_with($p, 'reports.customers') ||
                $p === 'os.work_order.view' ||
                $p === 'notifications.notification.view' ||
                $p === 'notifications.notification.update' ||
                $p === 'platform.dashboard.view'
            );
            $vendedor->syncPermissions($vendedorPerms);
        }

        // tecnico_vendedor: combina técnico + vendedor (vê valores)
        $tecnicoVendedor = Role::where('name', 'tecnico_vendedor')->first();
        if ($tecnicoVendedor) {
            $tvPerms = array_filter($permissions, fn($p) =>
                // técnico
                str_starts_with($p, 'os.work_order.') ||
                str_starts_with($p, 'technicians.') ||
                str_starts_with($p, 'service_calls.') ||
                str_starts_with($p, 'equipments.equipment.view') ||
                str_starts_with($p, 'estoque.movement.view') ||
                str_starts_with($p, 'hr.clock.') ||
                // vendedor
                str_starts_with($p, 'crm.') ||
                str_starts_with($p, 'quotes.') ||
                str_starts_with($p, 'comercial.') ||
                str_starts_with($p, 'commercial.') ||
                str_starts_with($p, 'cadastros.customer.') ||
                str_starts_with($p, 'customer.') ||
                str_starts_with($p, 'cadastros.product.') ||
                str_starts_with($p, 'cadastros.service.') ||
                str_starts_with($p, 'catalog.') ||
                str_starts_with($p, 'reports.crm') ||
                str_starts_with($p, 'reports.quotes') ||
                str_starts_with($p, 'reports.customers') ||
                $p === 'expenses.expense.create' ||
                $p === 'expenses.expense.view' ||
                $p === 'notifications.notification.view' ||
                $p === 'notifications.notification.update' ||
                $p === 'platform.dashboard.view'
            );
            $tecnicoVendedor->syncPermissions($tvPerms);
        }

        // motorista: operação em campo com despesas e abastecimento
        $motorista = Role::where('name', 'motorista')->first();
        if ($motorista) {
            $motoristaPerms = [
                'os.work_order.view',
                'os.work_order.update',
                'os.work_order.change_status',
                'expenses.expense.create',
                'expenses.expense.view',
                'expenses.fueling_log.create',
                'expenses.fueling_log.view',
                'fleet.vehicle.view',
                'fleet.view',
                'technicians.cashbox.view',
                'technicians.schedule.view',
                'cadastros.customer.view',
                'notifications.notification.view',
                'notifications.notification.update',
                'hr.clock.view',
                'hr.clock.manage',
                'estoque.view',
                'estoque.transfer.create',
                'estoque.transfer.accept',
                'estoque.movement.view',
            ];
            $motorista->syncPermissions($motoristaPerms);
        }

        $this->command->info("✅ " . count($permissions) . " permissões criadas/verificadas ({$created} novas)");
        $this->command->info('✅ ' . count($roles) . ' roles configurados com nomes em português');
        $this->command->info('✅ Cada role recebeu permissões adequadas ao seu perfil');
    }
}
