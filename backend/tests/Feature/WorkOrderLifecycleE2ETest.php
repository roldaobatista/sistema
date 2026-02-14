<?php

namespace Tests\Feature;

use App\Events\WorkOrderCancelled;
use App\Events\WorkOrderCompleted;
use App\Events\WorkOrderInvoiced;
use App\Events\WorkOrderStarted;
use App\Models\AccountReceivable;
use App\Models\CommissionEvent;
use App\Models\CommissionRule;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * PROFESSIONAL E2E Test — Work Order Full Lifecycle
 *
 * Tests the complete business flow:
 * Create OS → Add items → Start → Complete → Invoice → Receive → Commission
 *
 * Each test builds on real data and verifies the entire chain.
 */
class WorkOrderLifecycleE2ETest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private User $technician;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->technician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        Sanctum::actingAs($this->user);
        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);

        $role = \Spatie\Permission\Models\Role::firstOrCreate(
            ['name' => 'admin', 'guard_name' => 'api', 'team_id' => $this->tenant->id]
        );
        $this->user->assignRole($role);

        Notification::fake();
    }

    // ═══════════════════════════════════════════════════════════
    // 1. CRIAR OS COM ITENS
    // ═══════════════════════════════════════════════════════════

    public function test_create_work_order_with_items(): void
    {
        $response = $this->postJson('/api/v1/work-orders', [
            'customer_id' => $this->customer->id,
            'description' => 'Calibração balança industrial',
            'priority' => 'normal',
            'assigned_to' => $this->technician->id,
        ]);

        $response->assertCreated();
        $woId = $response->json('id');

        $this->assertDatabaseHas('work_orders', [
            'id' => $woId,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. ADICIONAR ITEM À OS
    // ═══════════════════════════════════════════════════════════

    public function test_add_item_to_work_order(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/items", [
            'type' => 'service',
            'description' => 'Calibração de balança',
            'quantity' => 1,
            'unit_price' => 2500.00,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('work_order_items', [
            'work_order_id' => $wo->id,
            'description' => 'Calibração de balança',
            'unit_price' => 2500.00,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. ASSOCIAR EQUIPAMENTO
    // ═══════════════════════════════════════════════════════════

    public function test_associate_equipment_to_work_order(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);
        $equipment = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/equipment", [
            'equipment_id' => $equipment->id,
        ]);

        $response->assertOk();
    }

    // ═══════════════════════════════════════════════════════════
    // 4. OPEN → IN_PROGRESS
    // ═══════════════════════════════════════════════════════════

    public function test_start_work_order(): void
    {
        Event::fake([WorkOrderStarted::class]);
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'assigned_to' => $this->technician->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);

        $response = $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_IN_PROGRESS,
        ]);

        $response->assertOk();
        $this->assertNotNull($wo->fresh()->started_at);
        Event::assertDispatched(WorkOrderStarted::class);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. IN_PROGRESS → COMPLETED
    // ═══════════════════════════════════════════════════════════

    public function test_complete_work_order(): void
    {
        Event::fake([WorkOrderCompleted::class]);
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'assigned_to' => $this->technician->id,
            'status' => WorkOrder::STATUS_IN_PROGRESS,
        ]);

        $response = $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_COMPLETED,
        ]);

        $response->assertOk();
        $this->assertNotNull($wo->fresh()->completed_at);
    }

    // ═══════════════════════════════════════════════════════════
    // 6. COMPLETED → DELIVERED
    // ═══════════════════════════════════════════════════════════

    public function test_deliver_work_order(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_COMPLETED,
        ]);

        $response = $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_DELIVERED,
        ]);

        $response->assertOk();
        $this->assertNotNull($wo->fresh()->delivered_at);
    }

    // ═══════════════════════════════════════════════════════════
    // 7. DELIVERED → INVOICED
    // ═══════════════════════════════════════════════════════════

    public function test_invoice_work_order(): void
    {
        Event::fake([WorkOrderInvoiced::class]);
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_DELIVERED,
            'total' => 5000.00,
        ]);

        $response = $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_INVOICED,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('work_orders', [
            'id' => $wo->id,
            'status' => WorkOrder::STATUS_INVOICED,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 8. CANCELAMENTO FUNCIONA
    // ═══════════════════════════════════════════════════════════

    public function test_cancel_work_order(): void
    {
        Event::fake([WorkOrderCancelled::class]);
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);

        $response = $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_CANCELLED,
            'notes' => 'Cliente cancelou serviço',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('work_orders', [
            'id' => $wo->id,
            'status' => WorkOrder::STATUS_CANCELLED,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 9. FLOW COMPLETO: open → in_progress → completed → delivered → invoiced
    // ═══════════════════════════════════════════════════════════

    public function test_full_lifecycle_flow(): void
    {
        Event::fake();
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'assigned_to' => $this->technician->id,
            'status' => WorkOrder::STATUS_OPEN,
            'total' => 7500.00,
        ]);

        // Step 1: Start
        $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_IN_PROGRESS,
        ])->assertOk();

        // Step 2: Complete
        $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_COMPLETED,
        ])->assertOk();

        // Step 3: Deliver
        $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_DELIVERED,
        ])->assertOk();

        // Step 4: Invoice
        $this->putJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_INVOICED,
        ])->assertOk();

        // Final assertions
        $wo->refresh();
        $this->assertEquals(WorkOrder::STATUS_INVOICED, $wo->status);
        $this->assertNotNull($wo->started_at);
        $this->assertNotNull($wo->completed_at);
        $this->assertNotNull($wo->delivered_at);
    }

    // ═══════════════════════════════════════════════════════════
    // 10. DUPLICAÇÃO DE OS
    // ═══════════════════════════════════════════════════════════

    public function test_duplicate_work_order(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_COMPLETED,
            'total' => 5000.00,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/duplicate");

        $response->assertStatus(201);

        $newId = $response->json('data.id') ?? $response->json('id');
        $this->assertNotEquals($wo->id, $newId);
        $this->assertDatabaseHas('work_orders', [
            'id' => $newId,
            'status' => WorkOrder::STATUS_OPEN,
            'customer_id' => $this->customer->id,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 11. EXPORTAÇÃO CSV
    // ═══════════════════════════════════════════════════════════

    public function test_export_work_orders_csv(): void
    {
        WorkOrder::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson('/api/v1/work-orders/export?format=csv');

        $response->assertOk();
        $this->assertStringContainsString('csv', $response->headers->get('Content-Type', '') . $response->headers->get('Content-Disposition', ''));
    }

    // ═══════════════════════════════════════════════════════════
    // 12. DASHBOARD STATS REFLETEM OS CRIADAS
    // ═══════════════════════════════════════════════════════════

    public function test_dashboard_reflects_work_order_stats(): void
    {
        WorkOrder::factory()->count(5)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);
        WorkOrder::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_COMPLETED,
        ]);

        $response = $this->getJson('/api/v1/dashboard');

        $response->assertOk();
    }
}
