<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Notification;
use App\Models\PaymentMethod;
use App\Models\Payment;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\Invoice;
use App\Models\ChartOfAccount;
use App\Models\ServiceCall;
use App\Models\SlaPolicy;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class RoutePermissionHardeningTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        setPermissionsTeamId($this->tenant->id);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Sanctum::actingAs($this->user, ['*']);
    }

    private function grant(string ...$permissions): void
    {
        setPermissionsTeamId($this->tenant->id);

        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        $this->user->syncPermissions($permissions);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_payment_methods_index_requires_any_financial_view_permission(): void
    {
        PaymentMethod::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Pix',
            'code' => 'pix',
            'sort_order' => 1,
        ]);

        $this->getJson('/api/v1/payment-methods')
            ->assertForbidden();

        $this->grant('finance.receivable.view');

        $this->getJson('/api/v1/payment-methods')
            ->assertOk()
            ->assertJsonFragment(['code' => 'pix']);
        $this->user->syncPermissions([]);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->grant('finance.payable.view');

        $this->getJson('/api/v1/payment-methods')
            ->assertOk()
            ->assertJsonFragment(['code' => 'pix']);
    }

    public function test_payment_methods_crud_requires_granular_finance_payable_permissions(): void
    {
        $createPayload = [
            'name' => 'Boleto',
            'code' => 'boleto',
            'is_active' => true,
        ];

        $this->postJson('/api/v1/payment-methods', $createPayload)
            ->assertForbidden();

        $this->grant('finance.payable.create');

        $this->postJson('/api/v1/payment-methods', $createPayload)
            ->assertCreated()
            ->assertJsonFragment(['code' => 'boleto']);

        $methodId = PaymentMethod::query()
            ->where('tenant_id', $this->tenant->id)
            ->where('code', 'boleto')
            ->value('id');
        $this->assertNotNull($methodId);

        $this->putJson("/api/v1/payment-methods/{$methodId}", ['name' => 'Boleto Atualizado'])
            ->assertForbidden();

        $this->grant('finance.payable.update');

        $this->putJson("/api/v1/payment-methods/{$methodId}", ['name' => 'Boleto Atualizado'])
            ->assertOk()
            ->assertJsonFragment(['name' => 'Boleto Atualizado']);

        $this->deleteJson("/api/v1/payment-methods/{$methodId}")
            ->assertForbidden();

        $this->grant('finance.payable.delete');

        $this->deleteJson("/api/v1/payment-methods/{$methodId}")
            ->assertNoContent();
    }

    public function test_payments_routes_require_any_financial_view_permission(): void
    {
        $payable = AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Conta a pagar',
            'amount' => 500,
            'amount_paid' => 0,
            'due_date' => now()->addDays(5)->toDateString(),
            'status' => 'pending',
        ]);

        $receivable = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Conta a receber',
            'amount' => 600,
            'amount_paid' => 0,
            'due_date' => now()->addDays(5)->toDateString(),
            'status' => 'pending',
        ]);

        Payment::create([
            'tenant_id' => $this->tenant->id,
            'payable_type' => AccountPayable::class,
            'payable_id' => $payable->id,
            'received_by' => $this->user->id,
            'amount' => 200,
            'payment_method' => 'pix',
            'payment_date' => now()->toDateString(),
        ]);

        Payment::create([
            'tenant_id' => $this->tenant->id,
            'payable_type' => AccountReceivable::class,
            'payable_id' => $receivable->id,
            'received_by' => $this->user->id,
            'amount' => 300,
            'payment_method' => 'cash',
            'payment_date' => now()->toDateString(),
        ]);

        $this->getJson('/api/v1/payments')
            ->assertForbidden();
        $this->getJson('/api/v1/payments-summary')
            ->assertForbidden();

        $this->grant('finance.payable.view');

        $this->getJson('/api/v1/payments')
            ->assertOk()
            ->assertJsonPath('total', 2);
        $this->getJson('/api/v1/payments-summary')
            ->assertOk()
            ->assertJsonPath('count', 2);

        $this->user->syncPermissions([]);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->grant('finance.receivable.view');

        $this->getJson('/api/v1/payments')
            ->assertOk()
            ->assertJsonPath('total', 2);
        $this->getJson('/api/v1/payments-summary')
            ->assertOk()
            ->assertJsonPath('count', 2);
    }

    public function test_payment_destroy_accepts_any_settle_permission(): void
    {
        $receivable = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Receber para estorno',
            'amount' => 400,
            'amount_paid' => 0,
            'due_date' => now()->addDays(5)->toDateString(),
            'status' => 'pending',
        ]);

        $payment = Payment::create([
            'tenant_id' => $this->tenant->id,
            'payable_type' => AccountReceivable::class,
            'payable_id' => $receivable->id,
            'received_by' => $this->user->id,
            'amount' => 100,
            'payment_method' => 'pix',
            'payment_date' => now()->toDateString(),
        ]);

        $this->deleteJson("/api/v1/payments/{$payment->id}")
            ->assertForbidden();

        $this->grant('finance.payable.settle');

        $this->deleteJson("/api/v1/payments/{$payment->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Pagamento estornado com sucesso');
    }

    public function test_bank_reconciliation_view_routes_require_finance_receivable_view(): void
    {
        $statement = BankStatement::create([
            'tenant_id' => $this->tenant->id,
            'filename' => 'extrato.ofx',
            'created_by' => $this->user->id,
            'total_entries' => 1,
            'matched_entries' => 0,
        ]);

        BankStatementEntry::create([
            'bank_statement_id' => $statement->id,
            'tenant_id' => $this->tenant->id,
            'date' => now()->toDateString(),
            'description' => 'Credito via PIX',
            'amount' => 100,
            'type' => 'credit',
            'status' => BankStatementEntry::STATUS_PENDING,
        ]);

        $this->getJson('/api/v1/bank-reconciliation/statements')
            ->assertForbidden();
        $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/entries")
            ->assertForbidden();

        $this->grant('finance.receivable.view');

        $this->getJson('/api/v1/bank-reconciliation/statements')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.data.0.id', $statement->id);
        $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/entries")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.data.0.type', 'credit');
    }

    public function test_bank_reconciliation_mutation_routes_require_finance_receivable_create(): void
    {
        $statement = BankStatement::create([
            'tenant_id' => $this->tenant->id,
            'filename' => 'extrato.ofx',
            'created_by' => $this->user->id,
            'total_entries' => 1,
            'matched_entries' => 0,
        ]);

        $entry = BankStatementEntry::create([
            'bank_statement_id' => $statement->id,
            'tenant_id' => $this->tenant->id,
            'date' => now()->toDateString(),
            'description' => 'Debito fornecedor',
            'amount' => 100,
            'type' => 'debit',
            'status' => BankStatementEntry::STATUS_PENDING,
        ]);

        $payable = AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Fornecedor de teste',
            'amount' => 100,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => AccountPayable::STATUS_PENDING,
        ]);

        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => 'payable',
            'matched_id' => $payable->id,
        ])->assertForbidden();

        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/ignore")
            ->assertForbidden();

        $this->grant('finance.receivable.create');

        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => 'payable',
            'matched_id' => $payable->id,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', BankStatementEntry::STATUS_MATCHED);

        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/ignore")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', BankStatementEntry::STATUS_IGNORED);
    }

    public function test_chart_of_accounts_routes_require_granular_permissions(): void
    {
        $payload = [
            'code' => '1.1.001',
            'name' => 'Caixa Operacional',
            'type' => 'asset',
        ];

        $this->getJson('/api/v1/chart-of-accounts')
            ->assertForbidden();

        $this->postJson('/api/v1/chart-of-accounts', $payload)
            ->assertForbidden();

        $this->grant('finance.chart.view');

        $this->getJson('/api/v1/chart-of-accounts')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->postJson('/api/v1/chart-of-accounts', $payload)
            ->assertForbidden();

        $this->grant('finance.chart.create');

        $createResponse = $this->postJson('/api/v1/chart-of-accounts', $payload);
        $createResponse->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.code', '1.1.001');

        $accountId = ChartOfAccount::query()
            ->where('tenant_id', $this->tenant->id)
            ->where('code', '1.1.001')
            ->value('id');
        $this->assertNotNull($accountId);

        $this->putJson("/api/v1/chart-of-accounts/{$accountId}", [
            'name' => 'Caixa Atualizado',
        ])->assertForbidden();

        $this->grant('finance.chart.update');

        $this->putJson("/api/v1/chart-of-accounts/{$accountId}", [
            'name' => 'Caixa Atualizado',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Caixa Atualizado');

        $this->deleteJson("/api/v1/chart-of-accounts/{$accountId}")
            ->assertForbidden();

        $this->grant('finance.chart.delete');

        $this->deleteJson("/api/v1/chart-of-accounts/{$accountId}")
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_invoice_routes_require_granular_finance_receivable_permissions(): void
    {
        $this->getJson('/api/v1/invoices')
            ->assertForbidden();
        $this->getJson('/api/v1/invoices/metadata')
            ->assertForbidden();

        $this->grant('finance.receivable.view');

        $this->getJson('/api/v1/invoices')
            ->assertOk();
        $this->getJson('/api/v1/invoices/metadata')
            ->assertOk()
            ->assertJsonStructure([
                'customers',
                'work_orders',
                'statuses',
            ]);

        $this->postJson('/api/v1/invoices', [
            'customer_id' => $this->customer->id,
        ])->assertForbidden();

        $this->grant('finance.receivable.create');

        $create = $this->postJson('/api/v1/invoices', [
            'customer_id' => $this->customer->id,
            'notes' => 'fatura de teste',
        ]);
        $create->assertCreated();
        $invoiceId = $create->json('id');
        $this->assertNotNull($invoiceId);

        $this->putJson("/api/v1/invoices/{$invoiceId}", [
            'status' => 'issued',
        ])->assertForbidden();

        $this->grant('finance.receivable.update');

        $this->putJson("/api/v1/invoices/{$invoiceId}", [
            'status' => 'issued',
        ])->assertOk()
            ->assertJsonPath('status', 'issued');

        $draftInvoice = Invoice::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'invoice_number' => Invoice::nextNumber($this->tenant->id),
            'status' => Invoice::STATUS_DRAFT,
            'total' => 100,
        ]);

        $this->deleteJson("/api/v1/invoices/{$draftInvoice->id}")
            ->assertForbidden();

        $this->grant('finance.receivable.delete');

        $this->deleteJson("/api/v1/invoices/{$draftInvoice->id}")
            ->assertNoContent();
    }

    public function test_dre_comparativo_requires_finance_dre_view_permission(): void
    {
        $uri = '/api/v1/cash-flow/dre-comparativo?date_from=2000-01-01&date_to=2100-01-01';

        $this->getJson($uri)->assertForbidden();

        $this->grant('finance.dre.view');

        $this->getJson($uri)
            ->assertOk()
            ->assertJsonStructure([
                'period',
                'current',
                'previous',
                'variation',
            ]);
    }

    public function test_cash_flow_requires_finance_cashflow_view_permission(): void
    {
        $this->getJson('/api/v1/cash-flow?months=3')
            ->assertForbidden();

        $this->grant('finance.cashflow.view');

        $this->getJson('/api/v1/cash-flow?months=3')
            ->assertOk();
    }

    public function test_dre_requires_finance_dre_view_permission(): void
    {
        $this->getJson('/api/v1/dre?date_from=2000-01-01&date_to=2100-01-01')
            ->assertForbidden();

        $this->grant('finance.dre.view');

        $this->getJson('/api/v1/dre?date_from=2000-01-01&date_to=2100-01-01')
            ->assertOk()
            ->assertJsonStructure([
                'period',
                'revenue',
                'costs',
                'expenses',
                'total_costs',
                'gross_profit',
            ]);
    }

    public function test_sla_dashboard_requires_os_work_order_view_permission(): void
    {
        $this->getJson('/api/v1/sla-dashboard/overview')
            ->assertForbidden();

        $this->grant('os.work_order.view');

        $this->getJson('/api/v1/sla-dashboard/overview')
            ->assertOk();
    }

    public function test_sla_dashboard_ignores_company_header_override_and_uses_current_tenant(): void
    {
        $this->grant('os.work_order.view');

        $otherTenant = Tenant::factory()->create();
        $otherUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
            'is_active' => true,
        ]);
        $otherCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);

        $policyCurrent = SlaPolicy::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'SLA atual',
            'response_time_minutes' => 60,
            'resolution_time_minutes' => 240,
            'priority' => 'medium',
            'is_active' => true,
        ]);
        $policyOther = SlaPolicy::withoutGlobalScopes()->create([
            'tenant_id' => $otherTenant->id,
            'name' => 'SLA outro',
            'response_time_minutes' => 60,
            'resolution_time_minutes' => 240,
            'priority' => 'medium',
            'is_active' => true,
        ]);

        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'sla_policy_id' => $policyCurrent->id,
        ]);

        $otherWo = WorkOrder::withoutGlobalScopes()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $otherCustomer->id,
            'created_by' => $otherUser->id,
            'number' => WorkOrder::nextNumber($otherTenant->id),
            'status' => WorkOrder::STATUS_OPEN,
            'priority' => WorkOrder::PRIORITY_NORMAL,
            'description' => 'OS outro tenant',
            'total' => 0,
            'origin_type' => WorkOrder::ORIGIN_MANUAL,
            'sla_policy_id' => $policyOther->id,
        ]);

        DB::table('work_orders')
            ->where('id', $otherWo->id)
            ->update(['sla_response_breached' => true]);

        $this->withHeader('X-Company-Id', (string) $otherTenant->id)
            ->getJson('/api/v1/sla-dashboard/overview')
            ->assertOk()
            ->assertJsonPath('total_com_sla', 1)
            ->assertJsonPath('response.estourado', 0);
    }

    public function test_central_routes_enforce_granular_permissions(): void
    {
        $this->getJson('/api/v1/central/items')
            ->assertForbidden();

        $this->grant('central.item.view');

        $this->getJson('/api/v1/central/items')
            ->assertOk();

        $payload = [
            'tipo' => 'TAREFA',
            'titulo' => 'Tarefa sem permissão de criação',
        ];

        $this->postJson('/api/v1/central/items', $payload)
            ->assertForbidden();

        $this->grant('central.item.view', 'central.create.task');

        $this->postJson('/api/v1/central/items', $payload)
            ->assertCreated();

        $this->getJson('/api/v1/central/rules')
            ->assertForbidden();

        $this->grant('central.manage.rules');

        $this->getJson('/api/v1/central/rules')
            ->assertOk();
    }

    public function test_notifications_routes_require_specific_permissions(): void
    {
        Notification::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => 'system',
            'title' => 'Notificacao de teste',
            'message' => 'Mensagem',
        ]);

        $this->getJson('/api/v1/notifications')
            ->assertForbidden();

        $this->grant('notifications.notification.view');

        $this->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('notifications.0.title', 'Notificacao de teste');

        $this->putJson('/api/v1/notifications/read-all')
            ->assertForbidden();

        $this->grant('notifications.notification.view', 'notifications.notification.update');

        $this->putJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('updated', 1);
    }

    public function test_report_export_requires_granular_export_permission(): void
    {
        $uri = '/api/v1/reports/work-orders/export?date_from=2000-01-01&date_to=2100-01-01';

        $this->getJson($uri)
            ->assertForbidden();

        $this->grant('reports.os_report.export');

        $response = $this->getJson($uri);
        $this->assertContains($response->status(), [200, 404]);
    }

    public function test_report_export_rejects_invalid_type_with_422(): void
    {
        $this->grant('reports.os_report.export');

        $this->getJson('/api/v1/reports/tipo-invalido/export')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Tipo de relatorio invalido.');
    }

    public function test_service_call_assignees_requires_service_call_view_permission(): void
    {
        $this->getJson('/api/v1/service-calls-assignees')
            ->assertForbidden();

        $this->grant('service_calls.service_call.view');

        $this->getJson('/api/v1/service-calls-assignees')
            ->assertOk()
            ->assertJsonStructure([
                'technicians',
                'drivers',
            ]);
    }

    public function test_service_call_store_blocks_assignment_fields_without_assign_permission(): void
    {
        $technician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $this->grant('service_calls.service_call.create');

        $response = $this->postJson('/api/v1/service-calls', [
            'customer_id' => $this->customer->id,
            'technician_id' => $technician->id,
            'scheduled_date' => now()->addDay()->toDateTimeString(),
        ]);

        $response->assertForbidden()
            ->assertJsonPath('message', 'Sem permissao para atribuir tecnico/agenda no chamado.');

        $this->assertDatabaseCount('service_calls', 0);
    }

    public function test_service_call_update_blocks_assignment_fields_without_assign_permission(): void
    {
        $technician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $initialSchedule = now()->addDays(2)->startOfHour();
        $call = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'technician_id' => null,
            'scheduled_date' => $initialSchedule->toDateTimeString(),
        ]);

        $this->grant('service_calls.service_call.update');

        $response = $this->putJson("/api/v1/service-calls/{$call->id}", [
            'technician_id' => $technician->id,
            'scheduled_date' => now()->addDay()->toDateTimeString(),
        ]);

        $response->assertForbidden()
            ->assertJsonPath('message', 'Sem permissao para atribuir tecnico/agenda no chamado.');

        $call->refresh();
        $this->assertNull($call->technician_id);
        $this->assertEquals($initialSchedule->toDateTimeString(), $call->scheduled_date?->toDateTimeString());
    }

    public function test_service_call_store_allows_assignment_fields_with_assign_permission(): void
    {
        $technician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $when = now()->addDay()->startOfHour();

        $this->grant('service_calls.service_call.create', 'service_calls.service_call.assign');

        $response = $this->postJson('/api/v1/service-calls', [
            'customer_id' => $this->customer->id,
            'technician_id' => $technician->id,
            'scheduled_date' => $when->toDateTimeString(),
        ]);

        $response->assertCreated()
            ->assertJsonPath('technician_id', $technician->id);

        $createdId = $response->json('id');
        $this->assertNotNull($createdId);
        $this->assertDatabaseHas('service_calls', [
            'id' => $createdId,
            'tenant_id' => $this->tenant->id,
            'technician_id' => $technician->id,
        ]);
    }

    public function test_service_call_update_allows_assignment_fields_with_assign_permission(): void
    {
        $technician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $call = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->grant('service_calls.service_call.update', 'service_calls.service_call.assign');

        $response = $this->putJson("/api/v1/service-calls/{$call->id}", [
            'technician_id' => $technician->id,
            'scheduled_date' => now()->addDay()->toDateTimeString(),
        ]);

        $response->assertOk()
            ->assertJsonPath('technician_id', $technician->id);
    }

    public function test_technicians_options_requires_any_technician_or_os_view_permission(): void
    {
        $role = Role::firstOrCreate(['name' => 'tecnico', 'guard_name' => 'web']);
        $technician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $technician->assignRole($role);

        $this->getJson('/api/v1/technicians/options')
            ->assertForbidden();

        $this->grant('technicians.schedule.view');

        $this->getJson('/api/v1/technicians/options')
            ->assertOk()
            ->assertJsonFragment(['id' => $technician->id, 'name' => $technician->name]);
        $this->user->syncPermissions([]);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->grant('os.work_order.view');

        $this->getJson('/api/v1/technicians/options')
            ->assertOk()
            ->assertJsonFragment(['id' => $technician->id, 'name' => $technician->name]);
    }
}
