<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkOrderTest extends TestCase
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

    // ── CRUD ──

    public function test_create_work_order(): void
    {
        $response = $this->postJson('/api/v1/work-orders', [
            'customer_id' => $this->customer->id,
            'description' => 'Calibração de balança rodoviária',
            'priority' => 'high',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('work_orders', [
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);
    }

    public function test_list_work_orders(): void
    {
        WorkOrder::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/work-orders');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_show_work_order(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson("/api/v1/work-orders/{$wo->id}");

        $response->assertOk()
            ->assertJsonPath('id', $wo->id);
    }

    public function test_update_work_order(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->putJson("/api/v1/work-orders/{$wo->id}", [
            'priority' => 'urgent',
            'description' => 'Descrição atualizada',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('work_orders', [
            'id' => $wo->id,
            'priority' => 'urgent',
        ]);
    }

    public function test_delete_work_order(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->deleteJson("/api/v1/work-orders/{$wo->id}");

        $response->assertStatus(204);
        $this->assertSoftDeleted('work_orders', ['id' => $wo->id]);
    }

    public function test_delete_work_order_with_financial_links_returns_conflict(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);

        \App\Models\AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'work_order_id' => $wo->id,
            'created_by' => $this->user->id,
            'description' => 'Título vinculado',
            'amount' => 100,
            'due_date' => now()->addDays(30),
            'status' => 'pending',
        ]);

        $response = $this->deleteJson("/api/v1/work-orders/{$wo->id}");

        $response->assertStatus(409)
            ->assertJsonFragment(['message' => 'Não é possível excluir esta OS — possui títulos financeiros vinculados']);

        $this->assertDatabaseHas('work_orders', ['id' => $wo->id]);
    }

    // ── Status Transitions ──

    public function test_transition_open_to_in_progress(): void
    {
        Event::fake();

        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_IN_PROGRESS,
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('work_orders', [
            'id' => $wo->id,
            'status' => WorkOrder::STATUS_IN_PROGRESS,
        ]);
    }

    public function test_invalid_status_transition_blocked(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_DELIVERED,
        ]);

        $response->assertStatus(422);
    }

    public function test_completed_transition(): void
    {
        Event::fake();

        $wo = WorkOrder::factory()->inProgress()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_COMPLETED,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('work_orders', [
            'id' => $wo->id,
            'status' => WorkOrder::STATUS_COMPLETED,
        ]);
    }

    // ── Items ──

    public function test_add_item_to_work_order(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/items", [
            'type' => 'service',
            'description' => 'Calibração industrial',
            'quantity' => 1,
            'unit_price' => 450.00,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('work_order_items', [
            'work_order_id' => $wo->id,
            'description' => 'Calibração industrial',
        ]);
    }

    // ── Metadata ──

    public function test_update_item_rejects_item_from_other_work_order(): void
    {
        $workOrderA = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $workOrderB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $itemB = WorkOrderItem::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrderB->id,
            'type' => 'service',
            'description' => 'Item da B',
            'quantity' => 1,
            'unit_price' => 100,
            'discount' => 0,
        ]);

        $response = $this->putJson("/api/v1/work-orders/{$workOrderA->id}/items/{$itemB->id}", [
            'description' => 'Tentativa indevida',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('message', 'Item não pertence a esta OS');
    }

    public function test_delete_item_rejects_item_from_other_work_order(): void
    {
        $workOrderA = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $workOrderB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $itemB = WorkOrderItem::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrderB->id,
            'type' => 'service',
            'description' => 'Item da B',
            'quantity' => 1,
            'unit_price' => 100,
            'discount' => 0,
        ]);

        $response = $this->deleteJson("/api/v1/work-orders/{$workOrderA->id}/items/{$itemB->id}");

        $response->assertStatus(403)
            ->assertJsonPath('message', 'Item não pertence a esta OS');

        $this->assertDatabaseHas('work_order_items', ['id' => $itemB->id]);
    }

    public function test_add_item_rejects_product_reference_from_other_tenant(): void
    {
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $otherTenant = Tenant::factory()->create();
        $foreignProduct = Product::factory()->create([
            'tenant_id' => $otherTenant->id,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$workOrder->id}/items", [
            'type' => 'product',
            'reference_id' => $foreignProduct->id,
            'description' => 'Item inválido',
            'quantity' => 1,
            'unit_price' => 150,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['reference_id']);
    }

    public function test_metadata_returns_statuses_and_priorities(): void
    {
        $response = $this->getJson('/api/v1/work-orders-metadata');

        $response->assertOk()
            ->assertJsonStructure(['statuses', 'priorities']);
    }

    // ── Tenant Isolation ──

    public function test_work_orders_isolated_by_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();

        WorkOrder::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'OS de Outro Tenant',
        ]);

        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'OS do Meu Tenant',
        ]);

        $response = $this->getJson('/api/v1/work-orders');

        $response->assertOk()
            ->assertDontSee('OS de Outro Tenant');
    }

    // ── Filter & Search ──

    public function test_filter_by_status(): void
    {
        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);

        WorkOrder::factory()->inProgress()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/work-orders?status=in_progress');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ── Business Rules ──

    public function test_cannot_delete_completed_work_order(): void
    {
        $wo = WorkOrder::factory()->completed()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->deleteJson("/api/v1/work-orders/{$wo->id}");

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Não é possível excluir OS concluída, entregue ou faturada');

        $this->assertDatabaseHas('work_orders', ['id' => $wo->id]);
    }

    public function test_rejects_invalid_status_transition(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);

        // open → delivered is not allowed
        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/status", [
            'status' => WorkOrder::STATUS_DELIVERED,
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['message', 'allowed']);

        $this->assertDatabaseHas('work_orders', ['id' => $wo->id, 'status' => WorkOrder::STATUS_OPEN]);
    }

    // ── New Endpoints ──

    public function test_duplicate_work_order(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        WorkOrderItem::create([
            'work_order_id' => $wo->id,
            'tenant_id' => $this->tenant->id,
            'type' => 'service',
            'description' => 'Test Service',
            'quantity' => 2,
            'unit_price' => '100.00',
            'discount' => '0.00',
            'total' => '200.00',
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/duplicate");

        $response->assertStatus(201)
            ->assertJsonPath('data.status', WorkOrder::STATUS_OPEN);

        $newId = $response->json('data.id');
        $this->assertNotEquals($wo->id, $newId);
        $this->assertDatabaseCount('work_orders', 2);
    }

    public function test_reopen_cancelled_work_order(): void
    {
        $wo = WorkOrder::factory()->cancelled()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/reopen");

        $response->assertOk();

        $this->assertDatabaseHas('work_orders', [
            'id' => $wo->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);
    }

    public function test_reopen_non_cancelled_returns_422(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$wo->id}/reopen");

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Apenas OS canceladas podem ser reabertas');
    }

    public function test_export_csv(): void
    {
        WorkOrder::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->get('/api/v1/work-orders-export');

        $response->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_dashboard_stats(): void
    {
        WorkOrder::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/work-orders-dashboard-stats');

        $response->assertOk()
            ->assertJsonStructure([
                'status_counts',
                'avg_completion_hours',
                'month_revenue',
                'sla_compliance',
                'total_orders',
                'top_customers',
            ]);
    }
}
