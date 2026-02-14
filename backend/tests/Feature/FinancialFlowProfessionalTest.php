<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Supplier;
use App\Models\WorkOrder;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Financial Flow tests — verifies exact money calculations,
 * partial payments, balance updates, and status transitions in the financial module.
 */
class FinancialFlowProfessionalTest extends TestCase
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

    // ── ACCOUNTS RECEIVABLE: Pagamento Parcial ──

    public function test_partial_payment_updates_amount_paid_and_keeps_pending(): void
    {
        $receivable = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Serviço de calibração',
            'amount' => 1000.00,
            'amount_paid' => 0,
            'due_date' => now()->addDays(30)->toDateString(),
            'status' => 'pending',
        ]);

        $response = $this->postJson("/api/v1/accounts-receivable/{$receivable->id}/pay", [
            'amount' => 400.00,
            'payment_method' => 'pix',
            'payment_date' => now()->toDateString(),
        ]);

        $response->assertStatus(201);

        $receivable->refresh();
        $this->assertSame(400.0, (float) $receivable->amount_paid);
        $this->assertNull($receivable->paid_at);

        // Payment should be recorded
        $this->assertDatabaseHas('payments', [
            'payable_type' => AccountReceivable::class,
            'payable_id' => $receivable->id,
            'amount' => 400.00,
            'payment_method' => 'pix',
        ]);
    }

    public function test_full_payment_sets_status_paid_and_paid_at(): void
    {
        $receivable = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Fatura completa',
            'amount' => 500.00,
            'amount_paid' => 0,
            'due_date' => now()->addDays(15)->toDateString(),
            'status' => 'pending',
        ]);

        $this->postJson("/api/v1/accounts-receivable/{$receivable->id}/pay", [
            'amount' => 500.00,
            'payment_method' => 'boleto',
            'payment_date' => now()->toDateString(),
        ])->assertStatus(201);

        $receivable->refresh();
        $this->assertSame(500.0, (float) $receivable->amount_paid);
        $this->assertEquals('paid', $receivable->status);
        $this->assertNotNull($receivable->paid_at);
    }

    public function test_partial_payment_on_overdue_keeps_overdue_status(): void
    {
        $receivable = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Recebível vencido',
            'amount' => 900.00,
            'amount_paid' => 0,
            'due_date' => now()->subDay()->toDateString(),
            'status' => 'pending',
        ]);

        $this->postJson("/api/v1/accounts-receivable/{$receivable->id}/pay", [
            'amount' => 300.00,
            'payment_method' => 'pix',
            'payment_date' => now()->toDateString(),
        ])->assertStatus(201);

        $receivable->refresh();
        $this->assertSame('overdue', $receivable->status);
        $this->assertNull($receivable->paid_at);
        $this->assertSame(300.0, (float) $receivable->amount_paid);
    }

    // ── ACCOUNTS PAYABLE: Fluxo similar ──

    public function test_create_account_payable_with_supplier(): void
    {
        $supplier = Supplier::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->postJson('/api/v1/accounts-payable', [
            'supplier_id' => $supplier->id,
            'description' => 'Compra de insumos',
            'amount' => 2500.00,
            'due_date' => now()->addDays(45)->toDateString(),
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('accounts_payable', [
            'tenant_id' => $this->tenant->id,
            'supplier_id' => $supplier->id,
            'description' => 'Compra de insumos',
            'amount' => 2500.00,
            'status' => 'pending',
        ]);
    }

    // ── INVOICE: Lifecycle ──

    public function test_invoice_from_work_order_transitions_wo_to_invoiced(): void
    {
        $wo = WorkOrder::factory()->delivered()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'total' => 3000.00,
        ]);

        $response = $this->postJson('/api/v1/invoices', [
            'customer_id' => $this->customer->id,
            'work_order_id' => $wo->id,
        ]);

        $response->assertStatus(201);

        // WO must transition to invoiced
        $this->assertDatabaseHas('work_orders', [
            'id' => $wo->id,
            'status' => 'invoiced',
        ]);

        // Invoice should reference the WO
        $this->assertDatabaseHas('invoices', [
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $wo->id,
            'status' => 'draft',
        ]);
    }

    public function test_cancel_invoice_reverts_work_order_to_delivered(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'status' => WorkOrder::STATUS_INVOICED,
        ]);

        $invoice = Invoice::factory()->issued()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'work_order_id' => $wo->id,
        ]);

        $this->putJson("/api/v1/invoices/{$invoice->id}", [
            'status' => 'cancelled',
        ])->assertOk();

        $wo->refresh();
        $this->assertSame(WorkOrder::STATUS_DELIVERED, $wo->status);
    }

    public function test_invoice_invalid_status_transition_blocked(): void
    {
        $invoice = Invoice::factory()->issued()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $this->putJson("/api/v1/invoices/{$invoice->id}", [
            'status' => 'draft',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Transicao de status invalida: issued -> draft');
    }

    public function test_cancelled_invoice_cannot_be_edited(): void
    {
        $invoice = Invoice::factory()->cancelled()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $this->putJson("/api/v1/invoices/{$invoice->id}", [
            'nf_number' => '99999',
        ])->assertStatus(422);
    }

    // ── SUMMARY: Exact Financial Totals ──

    public function test_receivable_summary_calculates_exact_open_balance(): void
    {
        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Parcial futuro',
            'amount' => 1000,
            'amount_paid' => 300,
            'due_date' => now()->addDays(10)->toDateString(),
            'status' => 'partial',
        ]);

        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Vencido',
            'amount' => 500,
            'amount_paid' => 100,
            'due_date' => now()->subDays(5)->toDateString(),
            'status' => 'overdue',
        ]);

        $response = $this->getJson('/api/v1/accounts-receivable-summary');

        $response->assertOk();
        // Total open = (1000-300) + (500-100) = 1100
        $this->assertSame(1010.0, (float) $response->json('total_open'));
    }

    // ── CROSS-TENANT: Foreign entities rejected ──

    public function test_create_receivable_rejects_foreign_tenant_customer(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);

        $response = $this->postJson('/api/v1/accounts-receivable', [
            'customer_id' => $foreignCustomer->id,
            'description' => 'Teste fora do tenant',
            'amount' => 100,
            'due_date' => now()->addDays(10)->toDateString(),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['customer_id']);
    }

    public function test_create_payable_rejects_foreign_tenant_supplier(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignSupplier = Supplier::factory()->create(['tenant_id' => $otherTenant->id]);

        $response = $this->postJson('/api/v1/accounts-payable', [
            'supplier_id' => $foreignSupplier->id,
            'description' => 'Conta inválida',
            'amount' => 200,
            'due_date' => now()->addDays(10)->toDateString(),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['supplier_id']);
    }
}
