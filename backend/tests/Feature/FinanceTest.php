<?php

namespace Tests\Feature;

use App\Models\AccountPayableCategory;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\WorkOrder;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── Invoice CRUD ──

    public function test_create_invoice(): void
    {
        $response = $this->postJson('/api/v1/invoices', [
            'customer_id' => $this->customer->id,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('invoices', [
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => 'draft',
        ]);
    }

    public function test_create_invoice_rejects_foreign_tenant_customer_and_work_order(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);
        $foreignWorkOrder = WorkOrder::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $foreignCustomer->id,
            'created_by' => User::factory()->create([
                'tenant_id' => $otherTenant->id,
                'current_tenant_id' => $otherTenant->id,
            ])->id,
        ]);

        $response = $this->postJson('/api/v1/invoices', [
            'customer_id' => $foreignCustomer->id,
            'work_order_id' => $foreignWorkOrder->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['customer_id', 'work_order_id']);
    }

    public function test_list_invoices(): void
    {
        Invoice::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/invoices');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_show_invoice(): void
    {
        $invoice = Invoice::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson("/api/v1/invoices/{$invoice->id}");

        $response->assertOk()
            ->assertJsonPath('id', $invoice->id);
    }

    public function test_update_invoice_status_to_issued(): void
    {
        $invoice = Invoice::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->putJson("/api/v1/invoices/{$invoice->id}", [
            'status' => 'issued',
            'nf_number' => '12345',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'status' => 'issued',
            'nf_number' => '12345',
        ]);
    }

    public function test_cancelled_invoice_cannot_be_edited(): void
    {
        $invoice = Invoice::factory()->cancelled()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->putJson("/api/v1/invoices/{$invoice->id}", [
            'nf_number' => '99999',
        ]);

        $response->assertStatus(422);
    }

    public function test_delete_invoice(): void
    {
        $invoice = Invoice::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->deleteJson("/api/v1/invoices/{$invoice->id}");

        $response->assertStatus(204);
    }

    // ── Invoice com OS ──

    public function test_create_invoice_from_work_order(): void
    {
        $wo = WorkOrder::factory()->delivered()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'total' => 1500.00,
        ]);

        $response = $this->postJson('/api/v1/invoices', [
            'customer_id' => $this->customer->id,
            'work_order_id' => $wo->id,
        ]);

        $response->assertStatus(201);

        // WO deve transicionar para invoiced
        $this->assertDatabaseHas('work_orders', [
            'id' => $wo->id,
            'status' => 'invoiced',
        ]);
    }

    // ── Auto NF Number ──

    public function test_invoice_auto_generates_number(): void
    {
        $response = $this->postJson('/api/v1/invoices', [
            'customer_id' => $this->customer->id,
        ]);

        $response->assertStatus(201);

        $invoice = Invoice::where('tenant_id', $this->tenant->id)->first();
        $this->assertStringStartsWith('NF-', $invoice->invoice_number);
    }

    // ── Tenant Isolation ──

    public function test_invoices_isolated_by_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();

        Invoice::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        Invoice::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/invoices');

        $response->assertOk();
        // Contagem deve incluir apenas do tenant
        $this->assertLessThanOrEqual(1, $response->json('meta.total'));
    }

    // ── Filtro por Status ──

    public function test_filter_invoices_by_status(): void
    {
        Invoice::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'status' => 'draft',
        ]);

        Invoice::factory()->issued()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/invoices?status=issued');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_invoice_search_and_payload_use_business_os_identifier(): void
    {
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-OS-1234',
            'number' => 'OS-000123',
        ]);

        $invoice = Invoice::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'work_order_id' => $workOrder->id,
        ]);

        $response = $this->getJson('/api/v1/invoices?search=BLOCO-OS-1234');

        $response->assertOk()
            ->assertJsonFragment(['id' => $invoice->id])
            ->assertJsonPath('data.0.work_order.os_number', 'BLOCO-OS-1234')
            ->assertJsonPath('data.0.work_order.business_number', 'BLOCO-OS-1234');
    }

    public function test_generate_account_receivable_from_work_order_uses_business_identifier(): void
    {
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-OS-9999',
            'number' => 'OS-000999',
            'total' => 850.00,
        ]);

        $response = $this->postJson('/api/v1/accounts-receivable/generate-from-os', [
            'work_order_id' => $workOrder->id,
            'due_date' => now()->addDays(15)->toDateString(),
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('description', 'OS BLOCO-OS-9999')
            ->assertJsonPath('work_order.os_number', 'BLOCO-OS-9999')
            ->assertJsonPath('work_order.business_number', 'BLOCO-OS-9999');
    }

    public function test_create_account_receivable_rejects_foreign_tenant_customer_and_work_order(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);
        $foreignWorkOrder = WorkOrder::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $foreignCustomer->id,
            'created_by' => User::factory()->create([
                'tenant_id' => $otherTenant->id,
                'current_tenant_id' => $otherTenant->id,
            ])->id,
        ]);

        $response = $this->postJson('/api/v1/accounts-receivable', [
            'customer_id' => $foreignCustomer->id,
            'work_order_id' => $foreignWorkOrder->id,
            'description' => 'Teste fora do tenant',
            'amount' => 100,
            'due_date' => now()->addDays(10)->toDateString(),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['customer_id', 'work_order_id']);
    }

    public function test_legacy_accounts_payable_categories_routes(): void
    {
        $create = $this->postJson('/api/v1/accounts-payable-categories', [
            'name' => 'Frete',
            'color' => '#111111',
        ]);

        $create->assertStatus(201)
            ->assertJsonPath('name', 'Frete');

        $id = $create->json('id');

        $this->getJson('/api/v1/accounts-payable-categories')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Frete']);

        $this->putJson("/api/v1/accounts-payable-categories/{$id}", [
            'name' => 'Frete Atualizado',
        ])->assertOk()->assertJsonPath('name', 'Frete Atualizado');

        $this->deleteJson("/api/v1/accounts-payable-categories/{$id}")
            ->assertStatus(204);
    }

    public function test_account_payable_categories_are_tenant_scoped(): void
    {
        $otherTenant = Tenant::factory()->create();

        AccountPayableCategory::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Meu Tenant',
            'is_active' => true,
        ]);

        AccountPayableCategory::withoutGlobalScopes()->create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Outro Tenant',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/account-payable-categories');

        $response->assertOk()
            ->assertJsonFragment(['name' => 'Meu Tenant'])
            ->assertJsonMissing(['name' => 'Outro Tenant']);
    }

    public function test_create_account_payable_rejects_foreign_tenant_supplier_and_category(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignSupplier = Supplier::factory()->create(['tenant_id' => $otherTenant->id]);
        $foreignCategory = AccountPayableCategory::withoutGlobalScopes()->create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Categoria externa',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/accounts-payable', [
            'supplier_id' => $foreignSupplier->id,
            'category_id' => $foreignCategory->id,
            'description' => 'Conta inválida',
            'amount' => 200,
            'due_date' => now()->addDays(10)->toDateString(),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['supplier_id', 'category_id']);
    }

    public function test_financial_export_csv_payable_returns_supplier_name(): void
    {
        $supplier = Supplier::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Fornecedor Alfa',
        ]);

        AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'supplier_id' => $supplier->id,
            'description' => 'Compra de insumos',
            'amount' => 350,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => 'pending',
        ]);

        $response = $this->get('/api/v1/financial/export/csv?type=payable&from=2000-01-01&to=2100-01-01');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('Fornecedor Alfa', $response->getContent());
    }

    public function test_financial_export_csv_receivable_accepts_os_number_filter(): void
    {
        $workOrderA = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-EXP-01',
            'number' => 'OS-7001',
        ]);
        $workOrderB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-EXP-02',
            'number' => 'OS-7002',
        ]);

        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'work_order_id' => $workOrderA->id,
            'created_by' => $this->user->id,
            'description' => 'Receita OS A',
            'amount' => 100,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => 'pending',
        ]);
        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'work_order_id' => $workOrderB->id,
            'created_by' => $this->user->id,
            'description' => 'Receita OS B',
            'amount' => 200,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => 'pending',
        ]);

        $response = $this->get('/api/v1/financial/export/csv?type=receivable&from=2000-01-01&to=2100-01-01&os_number=BLOCO-EXP-01');

        $response->assertOk();
        $content = $response->getContent();
        $this->assertStringContainsString('Receita OS A', $content);
        $this->assertStringNotContainsString('Receita OS B', $content);
    }

    public function test_receivable_summary_uses_open_balance_and_monthly_payments(): void
    {
        $futureReceivable = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Recebivel parcial futuro',
            'amount' => 1000,
            'amount_paid' => 300,
            'due_date' => now()->addDays(10)->toDateString(),
            'status' => 'partial',
        ]);

        $overdueReceivable = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Recebivel vencido',
            'amount' => 500,
            'amount_paid' => 100,
            'due_date' => now()->subDays(5)->toDateString(),
            'status' => 'overdue',
        ]);

        Payment::create([
            'tenant_id' => $this->tenant->id,
            'payable_type' => AccountReceivable::class,
            'payable_id' => $futureReceivable->id,
            'received_by' => $this->user->id,
            'amount' => 50,
            'payment_method' => 'pix',
            'payment_date' => now()->toDateString(),
        ]);

        Payment::create([
            'tenant_id' => $this->tenant->id,
            'payable_type' => AccountReceivable::class,
            'payable_id' => $overdueReceivable->id,
            'received_by' => $this->user->id,
            'amount' => 40,
            'payment_method' => 'pix',
            'payment_date' => now()->subMonth()->toDateString(),
        ]);

        $response = $this->getJson('/api/v1/accounts-receivable-summary');

        $response->assertOk();
        $this->assertSame(650.0, (float) $response->json('pending'));
        $this->assertSame(360.0, (float) $response->json('overdue'));
        $this->assertSame(1500.0, (float) $response->json('billed_this_month'));
        $this->assertSame(50.0, (float) $response->json('paid_this_month'));
        $this->assertSame(1010.0, (float) $response->json('total'));
        $this->assertSame(1010.0, (float) $response->json('total_open'));
    }

    public function test_pay_partial_on_past_due_receivable_keeps_status_overdue(): void
    {
        $receivable = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Recebivel vencido sem baixa',
            'amount' => 900,
            'amount_paid' => 0,
            'due_date' => now()->subDay()->toDateString(),
            'status' => 'pending',
        ]);

        $this->postJson("/api/v1/accounts-receivable/{$receivable->id}/pay", [
            'amount' => 300,
            'payment_method' => 'pix',
            'payment_date' => now()->toDateString(),
        ])->assertStatus(201);

        $receivable->refresh();
        $this->assertSame('overdue', $receivable->status);
        $this->assertNull($receivable->paid_at);
        $this->assertSame(300.0, (float) $receivable->amount_paid);
    }

    public function test_payable_summary_uses_open_balance_and_monthly_payments(): void
    {
        $futurePayable = AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Fornecedor parcial futuro',
            'amount' => 900,
            'amount_paid' => 200,
            'due_date' => now()->addDays(8)->toDateString(),
            'status' => 'partial',
        ]);

        $overduePayable = AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Fornecedor vencido',
            'amount' => 700,
            'amount_paid' => 100,
            'due_date' => now()->subDays(3)->toDateString(),
            'status' => 'overdue',
        ]);

        Payment::create([
            'tenant_id' => $this->tenant->id,
            'payable_type' => AccountPayable::class,
            'payable_id' => $futurePayable->id,
            'received_by' => $this->user->id,
            'amount' => 50,
            'payment_method' => 'pix',
            'payment_date' => now()->toDateString(),
        ]);

        Payment::create([
            'tenant_id' => $this->tenant->id,
            'payable_type' => AccountPayable::class,
            'payable_id' => $overduePayable->id,
            'received_by' => $this->user->id,
            'amount' => 70,
            'payment_method' => 'pix',
            'payment_date' => now()->subMonth()->toDateString(),
        ]);

        $response = $this->getJson('/api/v1/accounts-payable-summary');

        $response->assertOk();
        $this->assertSame(650.0, (float) $response->json('pending'));
        $this->assertSame(530.0, (float) $response->json('overdue'));
        $this->assertSame(1600.0, (float) $response->json('recorded_this_month'));
        $this->assertSame(50.0, (float) $response->json('paid_this_month'));
        $this->assertSame(1180.0, (float) $response->json('total_open'));
    }
}
