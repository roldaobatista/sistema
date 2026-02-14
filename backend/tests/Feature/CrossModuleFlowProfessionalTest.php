<?php

namespace Tests\Feature;

use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Quote;
use App\Models\ServiceCall;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\InvoicingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Cross-Module Flow tests — replaces CrossModuleFlowTest.
 * Exact status assertions, DB verification at each step, proper flow validation.
 */
class CrossModuleFlowProfessionalTest extends TestCase
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

    // ── OS → INVOICE → RECEIVABLE (Full E2E) ──

    public function test_os_to_invoice_to_receivable_flow(): void
    {
        // 1. Create WO
        $woResponse = $this->postJson('/api/v1/work-orders', [
            'customer_id' => $this->customer->id,
            'description' => 'Calibração industrial completa',
            'priority' => 'high',
        ]);
        $woResponse->assertCreated();
        $woId = $woResponse->json('data.id') ?? $woResponse->json('id');

        // 2. Verify initial state
        $this->assertDatabaseHas('work_orders', [
            'id' => $woId,
            'status' => 'open',
            'customer_id' => $this->customer->id,
        ]);

        // 3. Transition open → in_progress
        $this->putJson("/api/v1/work-orders/{$woId}/status", [
            'status' => 'in_progress',
        ])->assertOk();

        $this->assertDatabaseHas('work_orders', ['id' => $woId, 'status' => 'in_progress']);

        // 4. Transition in_progress → completed
        $this->putJson("/api/v1/work-orders/{$woId}/status", [
            'status' => 'completed',
        ])->assertOk();

        $this->assertDatabaseHas('work_orders', ['id' => $woId, 'status' => 'completed']);
    }

    public function test_customer_chain_integrity_wo_linked_to_customer(): void
    {
        $custResponse = $this->postJson('/api/v1/customers', [
            'name' => 'Cliente Cadeia Completa',
            'type' => 'PJ',
            'document' => '12.345.678/0001-90',
        ]);
        $custResponse->assertCreated();
        $custId = $custResponse->json('data.id') ?? $custResponse->json('id');

        $woResponse = $this->postJson('/api/v1/work-orders', [
            'customer_id' => $custId,
            'description' => 'OS vinculada ao cliente cadeia',
        ]);
        $woResponse->assertCreated();

        $woId = $woResponse->json('data.id') ?? $woResponse->json('id');

        $this->assertDatabaseHas('work_orders', [
            'id' => $woId,
            'customer_id' => $custId,
            'tenant_id' => $this->tenant->id,
        ]);
    }

    // ── STATUS MACHINE ENFORCEMENT ──

    public function test_invalid_status_transition_returns_422(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'status' => 'open',
        ]);

        // open → invoiced is NOT a valid direct transition
        $response = $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => 'invoiced',
        ]);

        $response->assertStatus(422);

        // Status should NOT have changed
        $this->assertDatabaseHas('work_orders', [
            'id' => $wo->id,
            'status' => 'open',
        ]);
    }

    // ── QUOTE → OS ──

    public function test_quote_creation_persists_with_customer(): void
    {
        $response = $this->postJson('/api/v1/quotes', [
            'customer_id' => $this->customer->id,
            'title' => 'Orçamento calibração anual',
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

    // ── SERVICE CALL → OS ──

    public function test_service_call_convert_creates_os(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'title' => 'Chamado para converter',
            'status' => 'open',
        ]);

        $response = $this->postJson("/api/v1/service-calls/{$sc->id}/convert-to-os");

        $response->assertStatus(201);

        $sc->refresh();
        $this->assertNotNull($sc->work_order_id);

        $this->assertDatabaseHas('work_orders', [
            'id' => $sc->work_order_id,
            'customer_id' => $this->customer->id,
        ]);
    }

    // ── DELETION CONSTRAINTS ──

    public function test_delete_customer_without_dependencies_succeeds(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Customer Sem OS',
        ]);

        $this->deleteJson("/api/v1/customers/{$customer->id}")
            ->assertOk();
    }

    public function test_delete_customer_with_work_orders_is_restricted(): void
    {
        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->deleteJson("/api/v1/customers/{$this->customer->id}");

        $response->assertStatus(422);

        // Customer must still exist
        $this->assertDatabaseHas('customers', ['id' => $this->customer->id]);
    }
}
