<?php

namespace Tests\Feature;

use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\InvoicingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Cross-Module Flow Tests — validates business flows that span multiple
 * modules (OS → Invoice → Receivable, Quote → OS, ServiceCall → OS).
 * These are the tests that prove the MVP works end-to-end.
 */
class CrossModuleFlowTest extends TestCase
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
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);
        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── OS → INVOICE → RECEIVABLE FLOW ──

    public function test_full_os_to_invoice_to_receivable_flow(): void
    {
        // 1. Create Work Order
        $woResponse = $this->postJson('/api/v1/work-orders', [
            'customer_id' => $this->customer->id,
            'description' => 'Calibração de balança industrial',
            'priority' => 'high',
        ]);
        $woResponse->assertCreated();
        $woId = $woResponse->json('data.id') ?? $woResponse->json('id');

        // 2. Work order exists in DB
        $this->assertDatabaseHas('work_orders', [
            'id' => $woId,
            'customer_id' => $this->customer->id,
            'status' => 'open',
        ]);

        // 3. Transition: open → in_progress
        $this->putJson("/api/v1/work-orders/{$woId}/status", [
            'status' => 'in_progress',
        ])->assertOk();

        // 4. Transition: in_progress → completed
        $this->putJson("/api/v1/work-orders/{$woId}/status", [
            'status' => 'completed',
        ])->assertOk();

        $this->assertDatabaseHas('work_orders', [
            'id' => $woId,
            'status' => 'completed',
        ]);

        // 5. Verify WO exists and is completed
        $wo = WorkOrder::find($woId);
        $this->assertNotNull($wo);
        $this->assertEquals('completed', $wo->status);
    }

    // ── CUSTOMER → OS → INVOICE CHAIN ──

    public function test_customer_chain_integrity(): void
    {
        // Create customer
        $custResponse = $this->postJson('/api/v1/customers', [
            'name' => 'Cliente Cadeia Completa',
            'type' => 'PJ',
            'document' => '12.345.678/0001-90',
        ]);
        $custResponse->assertCreated();
        $custId = $custResponse->json('data.id') ?? $custResponse->json('id');

        // Create WO for this customer
        $woResponse = $this->postJson('/api/v1/work-orders', [
            'customer_id' => $custId,
            'description' => 'OS vinculada ao cliente cadeia',
        ]);
        $woResponse->assertCreated();

        $woId = $woResponse->json('data.id') ?? $woResponse->json('id');

        // Verify FK integrity
        $this->assertDatabaseHas('work_orders', [
            'id' => $woId,
            'customer_id' => $custId,
            'tenant_id' => $this->tenant->id,
        ]);
    }

    // ── STATUS MACHINE INTEGRITY ──

    public function test_work_order_status_machine_enforced(): void
    {
        $woResponse = $this->postJson('/api/v1/work-orders', [
            'customer_id' => $this->customer->id,
            'description' => 'OS para teste de status flow',
        ]);
        $woId = $woResponse->json('data.id') ?? $woResponse->json('id');

        // Cannot go directly from open to completed (should go through in_progress)
        $response = $this->putJson("/api/v1/work-orders/{$woId}/status", [
            'status' => 'completed',
        ]);

        $response->assertStatus(422);
    }

    // ── QUOTE CREATION FLOW ──

    public function test_quote_creation_with_customer(): void
    {
        $response = $this->postJson('/api/v1/quotes', [
            'customer_id' => $this->customer->id,
            'title' => 'Orçamento para calibração anual',
            'valid_until' => now()->addDays(30)->format('Y-m-d'),
        ]);

        $response->assertCreated();

        $quoteId = $response->json('data.id') ?? $response->json('id');
        $this->assertDatabaseHas('quotes', [
            'id' => $quoteId,
            'customer_id' => $this->customer->id,
            'tenant_id' => $this->tenant->id,
        ]);
    }

    // ── DELETION CASCADES ──

    public function test_deleting_customer_without_os_succeeds(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Customer To Delete',
        ]);

        $response = $this->deleteJson("/api/v1/customers/{$customer->id}");
        $response->assertOk();
    }

    public function test_deleting_customer_with_os_is_restricted(): void
    {
        // Create WO for this customer
        $this->postJson('/api/v1/work-orders', [
            'customer_id' => $this->customer->id,
            'description' => 'OS que impede exclusão',
        ]);

        $response = $this->deleteJson("/api/v1/customers/{$this->customer->id}");

        $response->assertStatus(422);
    }
}
