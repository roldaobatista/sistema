<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use App\Models\Branch;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Criar permissões agrupadas
        $this->createPermissions();

        // Seeders de Câmeras
        $this->call([
            CameraSeeder::class,
        ]);

        // ─── TENANT 1 ─── Calibrações Brasil ──────────────────
        $t1 = Tenant::create([
            'name' => 'Calibrações Brasil',
            'document' => '12.345.678/0001-90',
            'email' => 'contato@calibracoes.com.br',
            'phone' => '(11) 3000-0001',
            'status' => 'active',
        ]);
        Branch::create(['tenant_id' => $t1->id, 'name' => 'Matriz SP', 'code' => 'MTZ', 'address_city' => 'São Paulo', 'address_state' => 'SP']);
        Branch::create(['tenant_id' => $t1->id, 'name' => 'Filial RJ', 'code' => 'FRJ', 'address_city' => 'Rio de Janeiro', 'address_state' => 'RJ']);

        // ─── TENANT 2 ─── TechAssist ──────────────────
        $t2 = Tenant::create([
            'name' => 'TechAssist Serviços',
            'document' => '98.765.432/0001-10',
            'email' => 'contato@techassist.com.br',
            'phone' => '(21) 4000-0002',
            'status' => 'active',
        ]);
        Branch::create(['tenant_id' => $t2->id, 'name' => 'Sede Central', 'code' => 'SED', 'address_city' => 'Campinas', 'address_state' => 'SP']);

        // ─── TENANT 3 ─── MedEquip ──────────────────
        $t3 = Tenant::create([
            'name' => 'MedEquip Metrologia',
            'document' => '11.222.333/0001-44',
            'email' => 'contato@medequip.com.br',
            'phone' => '(31) 5000-0003',
            'status' => 'active',
        ]);
        Branch::create(['tenant_id' => $t3->id, 'name' => 'Laboratório BH', 'code' => 'LBH', 'address_city' => 'Belo Horizonte', 'address_state' => 'MG']);

        // 4. Criar 8 roles
        $superAdmin = Role::create(['name' => 'super_admin', 'guard_name' => 'web']);
        $admin = Role::create(['name' => 'admin', 'guard_name' => 'web']);
        $manager = Role::create(['name' => 'gerente', 'guard_name' => 'web']);
        $technician = Role::create(['name' => 'tecnico', 'guard_name' => 'web']);
        $receptionist = Role::create(['name' => 'atendente', 'guard_name' => 'web']);
        $seller = Role::create(['name' => 'vendedor', 'guard_name' => 'web']);
        $driver = Role::create(['name' => 'motorista', 'guard_name' => 'web']);
        $financeiro = Role::create(['name' => 'financeiro', 'guard_name' => 'web']);
        $tecnicoVendedor = Role::create(['name' => 'tecnico_vendedor', 'guard_name' => 'web']);
        $inmetroManager = Role::create(['name' => 'inmetro_manager', 'guard_name' => 'web']);

        // Permissões por role
        $superAdmin->givePermissionTo(Permission::all());
        $admin->givePermissionTo(Permission::whereNot('name', 'LIKE', 'platform.%')->get());
        $manager->givePermissionTo([
            'iam.user.view',
            'cadastros.customer.view', 'cadastros.customer.create', 'cadastros.customer.update',
            'cadastros.product.view', 'cadastros.service.view',
            'os.work_order.view', 'os.work_order.create', 'os.work_order.update', 'os.work_order.delete',
            'os.work_order.assign', 'os.work_order.change_status', 'os.work_order.apply_discount',
            'technicians.technician.view', 'technicians.schedule.view', 'technicians.schedule.manage',
            'finance.receivable.view', 'finance.receivable.create', 'finance.receivable.settle',
            'finance.receivable.update', 'finance.receivable.delete',
            'finance.payable.view', 'finance.payable.create', 'finance.payable.settle',
            'finance.payable.update', 'finance.payable.delete',
            'finance.cashflow.view', 'finance.dre.view', 'platform.dashboard.view',
            'commissions.rule.view', 'commissions.settlement.view',
            'expenses.expense.view', 'expenses.expense.approve',
            'reports.os_report.view', 'reports.os_report.export',
            'reports.financial_report.view', 'reports.financial_report.export',
            'reports.productivity_report.view', 'reports.productivity_report.export',
            'reports.commission_report.view', 'reports.commission_report.export',
            'reports.margin_report.view', 'reports.margin_report.export',
            'reports.technician_cash_report.view', 'reports.technician_cash_report.export',
            'reports.quotes_report.view', 'reports.quotes_report.export',
            'reports.service_calls_report.view', 'reports.service_calls_report.export',
            'reports.crm_report.view', 'reports.crm_report.export',
            'reports.equipments_report.view', 'reports.equipments_report.export',
            'reports.suppliers_report.view', 'reports.suppliers_report.export',
            'reports.stock_report.view', 'reports.stock_report.export',
            'reports.customers_report.view', 'reports.customers_report.export',
            'quotes.quote.view', 'quotes.quote.create', 'quotes.quote.update', 'quotes.quote.delete', 'quotes.quote.approve', 'quotes.quote.send', 'quotes.quote.convert',
            'service_calls.service_call.view', 'service_calls.service_call.create', 'service_calls.service_call.update', 'service_calls.service_call.delete', 'service_calls.service_call.assign',
            'central.item.view', 'central.create.task', 'central.assign', 'central.close.self', 'central.manage.kpis', 'central.manage.rules',
            'notifications.notification.view', 'notifications.notification.update',
            'fiscal.note.view', 'fiscal.note.create', 'fiscal.note.cancel', 'fiscal.note.export',
            'inmetro.intelligence.view',
            'email.inbox.view', 'email.inbox.send', 'email.inbox.create_task',
            'email.account.view', 'email.rule.view',
            'hr.performance.view', 'hr.performance.create', 'hr.performance.update', 'hr.performance.delete', 'hr.performance.view_all', 'hr.performance.manage',
            'hr.feedback.view', 'hr.feedback.create', 'hr.feedback.update', 'hr.feedback.delete', 'hr.feedback.view_all',
        ]);
        $technician->givePermissionTo([
            'cadastros.customer.view', 'cadastros.product.view', 'cadastros.service.view',
            'os.work_order.view', 'os.work_order.update', 'os.work_order.change_status',
            'technicians.time_entry.create', 'technicians.time_entry.view',
            'technicians.cashbox.view', 'technicians.cashbox.manage',
            'expenses.expense.create', 'expenses.expense.view', 'expenses.expense.update',
            'service_calls.service_call.view', 'service_calls.service_call.update',
            'central.item.view', 'central.create.task', 'central.close.self',
            'notifications.notification.view', 'notifications.notification.update',
        ]);
        $receptionist->givePermissionTo([
            'cadastros.customer.view', 'cadastros.customer.create', 'cadastros.customer.update',
            'cadastros.product.view', 'cadastros.service.view',
            'os.work_order.view', 'os.work_order.create', 'os.work_order.update',
            'finance.receivable.view', 'finance.receivable.create', 'finance.receivable.settle',
            'service_calls.service_call.view', 'service_calls.service_call.create', 'service_calls.service_call.update',
            'central.item.view', 'central.create.task', 'central.close.self',
            'notifications.notification.view', 'notifications.notification.update',
            'hr.performance.view', 'hr.performance.create', 'hr.performance.update',
            'hr.feedback.view', 'hr.feedback.create',
        ]);
        $seller->givePermissionTo([
            'cadastros.customer.view', 'cadastros.customer.create', 'cadastros.customer.update',
            'cadastros.product.view', 'cadastros.service.view',
            'os.work_order.view', 'os.work_order.create',
            'commissions.rule.view', 'commissions.settlement.view',
            'reports.os_report.view', 'reports.quotes_report.view',
            'reports.customers_report.view',
            'quotes.quote.view', 'quotes.quote.create', 'quotes.quote.update', 'quotes.quote.send', 'quotes.quote.convert',
            'service_calls.service_call.view', 'service_calls.service_call.create',
            'central.item.view', 'central.create.task', 'central.close.self',
            'notifications.notification.view', 'notifications.notification.update',
            'hr.performance.view', 'hr.performance.create', 'hr.performance.update',
            'hr.feedback.view', 'hr.feedback.create',
        ]);
        $driver->givePermissionTo([
            'os.work_order.view',
            'technicians.time_entry.create', 'technicians.time_entry.view',
            'expenses.expense.create', 'expenses.expense.view',
            'expenses.fueling_log.view', 'expenses.fueling_log.create',
            'notifications.notification.view', 'notifications.notification.update',
            'hr.performance.view', 'hr.performance.create', 'hr.performance.update',
            'hr.feedback.view', 'hr.feedback.create',
        ]);
        $financeiro->givePermissionTo([
            'finance.receivable.view', 'finance.receivable.create', 'finance.receivable.settle',
            'finance.receivable.update', 'finance.receivable.delete',
            'finance.payable.view', 'finance.payable.create', 'finance.payable.settle',
            'finance.payable.update', 'finance.payable.delete',
            'finance.chart.view', 'finance.chart.create', 'finance.chart.update', 'finance.chart.delete',
            'finance.cashflow.view', 'finance.dre.view', 'platform.dashboard.view',
            'commissions.rule.view', 'commissions.rule.create', 'commissions.rule.update',
            'commissions.settlement.view', 'commissions.settlement.create',
            'commissions.dispute.view', 'commissions.dispute.create', 'commissions.dispute.resolve',
            'commissions.goal.view', 'commissions.goal.create', 'commissions.goal.update', 'commissions.goal.delete',
            'commissions.campaign.view', 'commissions.campaign.create', 'commissions.campaign.update', 'commissions.campaign.delete',
            'commissions.recurring.view', 'commissions.recurring.create', 'commissions.recurring.update', 'commissions.recurring.delete',
            'expenses.expense.view', 'expenses.expense.approve',
            'reports.financial_report.view', 'reports.financial_report.export',
            'reports.commission_report.view', 'reports.commission_report.export',
            'reports.margin_report.view', 'reports.margin_report.export',
            'central.item.view', 'central.create.task', 'central.close.self', 'central.manage.kpis', 'central.manage.rules',
            'notifications.notification.view', 'notifications.notification.update',
            'fiscal.note.view', 'fiscal.note.create', 'fiscal.note.cancel', 'fiscal.note.export',
            'email.inbox.view', 'email.inbox.send', 'email.inbox.create_task',
            'email.account.view', 'email.rule.view',
            'hr.performance.view', 'hr.performance.create', 'hr.performance.update',
            'hr.feedback.view', 'hr.feedback.create',
        ]);

        // GAP-16: tecnico_vendedor — combina permissões de técnico + vendedor
        $tecnicoVendedor->givePermissionTo([
            // Cadastros
            'cadastros.customer.view', 'cadastros.customer.create', 'cadastros.customer.update',
            'cadastros.product.view', 'cadastros.service.view',
            // OS
            'os.work_order.view', 'os.work_order.create', 'os.work_order.update', 'os.work_order.change_status',
            // Técnico
            'technicians.time_entry.create', 'technicians.time_entry.view',
            'technicians.cashbox.view', 'technicians.cashbox.manage',
            // Despesas
            'expenses.expense.create', 'expenses.expense.view', 'expenses.expense.update',
            // Comissões (somente visualização)
            'commissions.rule.view', 'commissions.settlement.view',
            // Orçamentos
            'quotes.quote.view', 'quotes.quote.create', 'quotes.quote.update', 'quotes.quote.send', 'quotes.quote.convert',
            // Relatórios
            'reports.os_report.view', 'reports.quotes_report.view', 'reports.customers_report.view',
            // Chamados
            'service_calls.service_call.view', 'service_calls.service_call.create', 'service_calls.service_call.update',
            // Sistema
            'notifications.notification.view', 'notifications.notification.update',
            'hr.performance.view', 'hr.performance.create', 'hr.performance.update',
            'hr.feedback.view', 'hr.feedback.create',
        ]);

        // inmetro_manager — full INMETRO intelligence + customer view
        $inmetroManager->givePermissionTo([
            'inmetro.intelligence.view', 'inmetro.intelligence.import',
            'inmetro.intelligence.enrich', 'inmetro.intelligence.convert',
            'cadastros.customer.view', 'cadastros.customer.create', 'cadastros.customer.update',
            'cadastros.product.view', 'cadastros.service.view',
            'reports.customers_report.view', 'reports.customers_report.export',
            'notifications.notification.view', 'notifications.notification.update',
            'platform.dashboard.view',
        ]);

        // ── Usuários ──────────────────

        // Super Admin (acesso a todas as empresas)
        $sa = $this->createUser('Administrador', 'admin@sistema.local', $t1, $superAdmin);
        $sa->tenants()->attach([$t2->id, $t3->id]);

        // Tenant 1 — Calibrações Brasil
        $this->createUser('Carlos Gerente', 'carlos@calibracoes.com.br', $t1, $manager);
        $this->createUser('Roberto Silva', 'roberto@calibracoes.com.br', $t1, $technician);
        $this->createUser('Anderson Costa', 'anderson@calibracoes.com.br', $t1, $technician);
        $this->createUser('Fernando Lima', 'fernando@calibracoes.com.br', $t1, $technician);
        $this->createUser('Juliana Souza', 'juliana@calibracoes.com.br', $t1, $receptionist);
        $this->createUser('Marcos Vendas', 'marcos@calibracoes.com.br', $t1, $seller);
        $this->createUser('José Motorista', 'jose@calibracoes.com.br', $t1, $driver);
        $this->createUser('Ana Financeiro', 'ana@calibracoes.com.br', $t1, $financeiro);

        // Tenant 2 — TechAssist
        $this->createUser('Paulo Admin', 'paulo@techassist.com.br', $t2, $admin);
        $this->createUser('Ricardo Técnico', 'ricardo@techassist.com.br', $t2, $technician);
        $this->createUser('Luciana Atendente', 'luciana@techassist.com.br', $t2, $receptionist);

        // Tenant 3 — MedEquip
        $this->createUser('Maria Admin', 'maria@medequip.com.br', $t3, $admin);
        $this->createUser('Pedro Técnico', 'pedro@medequip.com.br', $t3, $technician);

        // ── Clientes de exemplo (Tenant 1) ──────────────
        $customers = [];
        $customerData = [
            ['name' => 'Supermercado Bom Preço', 'document' => '12.345.678/0001-01', 'type' => 'PJ', 'phone' => '(11) 3333-1001', 'address_city' => 'São Paulo', 'address_state' => 'SP'],
            ['name' => 'Farmácia Popular Center', 'document' => '23.456.789/0001-02', 'type' => 'PJ', 'phone' => '(11) 3333-1002', 'address_city' => 'Guarulhos', 'address_state' => 'SP'],
            ['name' => 'Indústria Metalúrgica Forte', 'document' => '34.567.890/0001-03', 'type' => 'PJ', 'phone' => '(11) 3333-1003', 'address_city' => 'Osasco', 'address_state' => 'SP'],
            ['name' => 'Padaria Pão Dourado', 'document' => '45.678.901/0001-04', 'type' => 'PJ', 'phone' => '(11) 3333-1004', 'address_city' => 'Santo André', 'address_state' => 'SP'],
        ];
        foreach ($customerData as $c) {
            $customers[] = \App\Models\Customer::create(array_merge($c, ['tenant_id' => $t1->id, 'is_active' => true]));
        }

        // ── Equipamentos de exemplo (Tenant 1) ──────────
        $equipments = [
            ['customer_id' => $customers[0]->id, 'code' => 'EQP-00001', 'type' => 'Balança', 'category' => 'balanca_plataforma', 'brand' => 'Toledo', 'manufacturer' => 'Toledo do Brasil', 'model' => 'Prix 3 Plus', 'serial_number' => 'TLD-2024-001', 'capacity' => 30, 'capacity_unit' => 'kg', 'resolution' => 0.005, 'precision_class' => 'III', 'status' => 'ativo', 'location' => 'Setor Hortifruti', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(11), 'next_calibration_at' => now()->addMonths(1), 'is_critical' => true, 'is_active' => true],
            ['customer_id' => $customers[0]->id, 'code' => 'EQP-00002', 'type' => 'Balança', 'category' => 'balanca_contadora', 'brand' => 'Toledo', 'model' => 'Prix 4 Uno', 'serial_number' => 'TLD-2024-002', 'capacity' => 15, 'capacity_unit' => 'kg', 'resolution' => 0.005, 'precision_class' => 'III', 'status' => 'ativo', 'location' => 'Padaria', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(14), 'next_calibration_at' => now()->subMonths(2), 'is_critical' => false, 'is_active' => true],
            ['customer_id' => $customers[1]->id, 'code' => 'EQP-00003', 'type' => 'Balança', 'category' => 'balanca_analitica', 'brand' => 'Shimadzu', 'manufacturer' => 'Shimadzu Corp', 'model' => 'AUW220D', 'serial_number' => 'SHM-2023-101', 'capacity' => 0.220, 'capacity_unit' => 'kg', 'resolution' => 0.0001, 'precision_class' => 'I', 'status' => 'ativo', 'location' => 'Laboratório QC', 'calibration_interval_months' => 6, 'last_calibration_at' => now()->subMonths(5), 'next_calibration_at' => now()->addDays(12), 'is_critical' => true, 'is_active' => true, 'inmetro_number' => 'INMETRO-2023-5544'],
            ['customer_id' => $customers[2]->id, 'code' => 'EQP-00004', 'type' => 'Balança', 'category' => 'balanca_plataforma', 'brand' => 'Filizola', 'manufacturer' => 'Filizola', 'model' => 'ID-M 150', 'serial_number' => 'FLZ-2022-050', 'capacity' => 150, 'capacity_unit' => 'kg', 'resolution' => 0.05, 'precision_class' => 'III', 'status' => 'ativo', 'location' => 'Expedição', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(10), 'next_calibration_at' => now()->addMonths(2), 'is_critical' => false, 'is_active' => true],
            ['customer_id' => $customers[2]->id, 'code' => 'EQP-00005', 'type' => 'Balança', 'category' => 'balanca_rodoviaria', 'brand' => 'Toledo', 'manufacturer' => 'Toledo do Brasil', 'model' => 'Conquista 2040', 'serial_number' => 'TLD-2021-900', 'capacity' => 60000, 'capacity_unit' => 'kg', 'resolution' => 20, 'precision_class' => 'IIII', 'status' => 'em_manutencao', 'location' => 'Portaria', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(6), 'next_calibration_at' => now()->addMonths(6), 'is_critical' => true, 'is_active' => true],
            ['customer_id' => $customers[3]->id, 'code' => 'EQP-00006', 'type' => 'Balança', 'category' => 'balanca_precisao', 'brand' => 'Marte', 'manufacturer' => 'Marte Científica', 'model' => 'AD3300', 'serial_number' => 'MRT-2024-077', 'capacity' => 3.3, 'capacity_unit' => 'kg', 'resolution' => 0.01, 'precision_class' => 'II', 'status' => 'ativo', 'location' => 'Balcão', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(13), 'next_calibration_at' => now()->subDays(5), 'is_critical' => false, 'is_active' => true],
        ];
        foreach ($equipments as $eq) {
            \App\Models\Equipment::create(array_merge($eq, ['tenant_id' => $t1->id]));
        }
    }

    private function createUser(string $name, string $email, Tenant $tenant, Role $role): User
    {
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => 'password',
            'is_active' => true,
            'tenant_id' => $tenant->id,
            'current_tenant_id' => $tenant->id,
        ]);
        $user->assignRole($role);
        $user->tenants()->attach($tenant->id, ['is_default' => true]);
        return $user;
    }

    private function createPermissions(): void
    {
        $modules = [
            'iam' => [
                'user' => ['view', 'create', 'update', 'delete'],
                'role' => ['view', 'create', 'update', 'delete'],
                'permission' => ['view', 'manage'],
                'audit_log' => ['view'],
            ],
            'platform' => [
                'tenant' => ['view', 'create', 'update', 'delete'],
                'branch' => ['view', 'create', 'update', 'delete'],
                'settings' => ['view', 'manage'],
                'dashboard' => ['view'],
            ],
            'cadastros' => [
                'customer' => ['view', 'create', 'update', 'delete'],
                'product' => ['view', 'create', 'update', 'delete'],
                'service' => ['view', 'create', 'update', 'delete'],
                'supplier' => ['view', 'create', 'update', 'delete'],
            ],
            'os' => [
                'work_order' => ['view', 'create', 'update', 'delete', 'assign', 'change_status', 'print', 'export', 'authorize_dispatch', 'apply_discount'],
            ],
            'technicians' => [
                'technician' => ['view', 'create', 'update', 'delete'],
                'schedule' => ['view', 'manage'],
                'time_entry' => ['view', 'create', 'update', 'delete'],
                'cashbox' => ['view', 'manage'],
            ],
            'finance' => [
                'receivable' => ['view', 'create', 'update', 'delete', 'settle'],
                'payable' => ['view', 'create', 'update', 'delete', 'settle'],
                'cashflow' => ['view'],
                'dre' => ['view'],
                'chart' => ['view', 'create', 'update', 'delete'],
            ],
            'commissions' => [
                'rule' => ['view', 'create', 'update', 'delete'],
                'settlement' => ['view', 'create', 'approve', 'reject'],
                'dispute' => ['view', 'create', 'resolve'],
                'goal' => ['view', 'create', 'update', 'delete'],
                'campaign' => ['view', 'create', 'update', 'delete'],
                'recurring' => ['view', 'create', 'update', 'delete'],
            ],
            'expenses' => [
                'expense' => ['view', 'create', 'update', 'delete', 'review', 'approve'],
                'fueling_log' => ['view', 'create', 'update', 'delete', 'approve'],
            ],
            'settings' => [
                'general' => ['view', 'manage'],
                'status_flow' => ['view', 'manage'],
                'template' => ['view', 'manage'],
            ],
            'quotes' => [
                'quote' => ['view', 'create', 'update', 'delete', 'internal_approve', 'approve', 'send', 'convert'],
            ],
            'service_calls' => [
                'service_call' => ['view', 'create', 'update', 'delete', 'assign'],
            ],
            'equipments' => [
                'equipment' => ['view', 'create', 'update', 'delete'],
            ],
            'estoque' => [
                'movement' => ['view', 'create'],
            ],
            'import' => [
                'data' => ['view', 'execute', 'delete'],
            ],
            'crm' => [
                'deal' => ['view', 'create', 'update', 'delete'],
                'pipeline' => ['view', 'create', 'update', 'delete'],
                'message' => ['view', 'send'],
            ],
            'notifications' => [
                'notification' => ['view', 'update'],
            ],
            'reports' => [
                'os_report' => ['view', 'export'],
                'quotes_report' => ['view', 'export'],
                'productivity_report' => ['view', 'export'],
                'customers_report' => ['view', 'export'],
                'financial_report' => ['view', 'export'],
                'commission_report' => ['view', 'export'],
                'margin_report' => ['view', 'export'],
                'service_calls_report' => ['view', 'export'],
                'crm_report' => ['view', 'export'],
                'equipments_report' => ['view', 'export'],
                'suppliers_report' => ['view', 'export'],
                'stock_report' => ['view', 'export'],
                'technician_cash_report' => ['view', 'export'],
            ],
            'inmetro' => [
                'intelligence' => ['view', 'import', 'enrich', 'convert'],
            ],
            'fiscal' => [
                'note' => ['view', 'create', 'cancel', 'export'],
            ],
            'email' => [
                'inbox' => ['view', 'send', 'create_task'],
                'account' => ['view', 'create', 'update', 'delete', 'sync'],
                'rule' => ['view', 'create', 'update', 'delete'],
            ],
            'hr' => [
                'performance' => ['view', 'create', 'update', 'delete', 'view_all', 'manage'],
                'feedback' => ['view', 'create', 'update', 'delete', 'view_all'],
            ],
            'ai' => [
                'analytics' => ['view'],
            ],
        ];

        $order = 0;
        foreach ($modules as $module => $resources) {
            $group = \App\Models\PermissionGroup::firstOrCreate(
                ['name' => ucfirst(str_replace('_', ' ', $module))],
                ['order' => $order]
            );
            $order++;

            foreach ($resources as $resource => $actions) {
                foreach ($actions as $action) {
                    $criticality = in_array($action, ['delete', 'manage', 'approve']) ? 'HIGH' :
                        (in_array($action, ['create', 'update']) ? 'MED' : 'LOW');

                    $permission = Permission::firstOrCreate(
                        [
                            'name' => "{$module}.{$resource}.{$action}",
                            'guard_name' => 'web',
                        ],
                        [
                            'group_id' => $group->id,
                            'criticality' => $criticality,
                        ]
                    );

                    if (!$permission->group_id || !$permission->criticality) {
                        $permission->update([
                            'group_id' => $group->id,
                            'criticality' => $permission->criticality ?: $criticality,
                        ]);
                    }
                }
            }
        }
    }
}
