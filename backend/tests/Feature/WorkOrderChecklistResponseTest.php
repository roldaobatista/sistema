<?php

namespace Tests\Feature;

use App\Models\ServiceChecklist;
use App\Models\ServiceChecklistItem;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderChecklistResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkOrderChecklistResponseTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private ServiceChecklist $checklist;

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

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);

        // Manual setup since factories are missing
        $this->checklist = ServiceChecklist::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Checklist Padrão',
            'is_active' => true,
        ]);
    }

    public function test_store_saves_responses(): void
    {
        $item = ServiceChecklistItem::create([
            'checklist_id' => $this->checklist->id,
            'description' => 'Verificar óleo',
            'type' => 'text',
            'is_mandatory' => true,
            'sort_order' => 1,
        ]);

        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'checklist_id' => $this->checklist->id,
        ]);

        $payload = [
            'responses' => [
                [
                    'checklist_item_id' => $item->id,
                    'value' => 'OK',
                    'notes' => 'Nível normal',
                ]
            ]
        ];

        $response = $this->postJson("/api/v1/work-orders/{$workOrder->id}/checklist-responses", $payload);

        $response->assertOk()
            ->assertJson(['message' => 'Respostas do checklist salvas com sucesso.']);

        $this->assertDatabaseHas('work_order_checklist_responses', [
            'work_order_id' => $workOrder->id,
            'checklist_item_id' => $item->id,
            'value' => 'OK',
            'notes' => 'Nível normal',
        ]);
    }

    public function test_store_fails_if_item_does_not_belong_to_checklist(): void
    {
        // Item from another checklist
        $otherChecklist = ServiceChecklist::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Outro Checklist',
            'is_active' => true,
        ]);
        $otherItem = ServiceChecklistItem::create([
            'checklist_id' => $otherChecklist->id,
            'description' => 'Item Invasor',
            'type' => 'text',
        ]);

        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'checklist_id' => $this->checklist->id,
        ]);

        $payload = [
            'responses' => [
                [
                    'checklist_item_id' => $otherItem->id,
                    'value' => 'Hacked',
                ]
            ]
        ];

        $response = $this->postJson("/api/v1/work-orders/{$workOrder->id}/checklist-responses", $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['responses.0.checklist_item_id']);
    }

    public function test_index_returns_responses(): void
    {
        $item = ServiceChecklistItem::create([
            'checklist_id' => $this->checklist->id,
            'description' => 'Item Teste',
            'type' => 'text',
        ]);

        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'checklist_id' => $this->checklist->id,
        ]);

        WorkOrderChecklistResponse::create([
            'work_order_id' => $workOrder->id,
            'checklist_item_id' => $item->id,
            'value' => 'Valor Teste',
        ]);

        $response = $this->getJson("/api/v1/work-orders/{$workOrder->id}/checklist-responses");

        $response->assertOk()
            ->assertJsonPath('data.0.value', 'Valor Teste')
            ->assertJsonPath('data.0.item.description', 'Item Teste');
    }

    public function test_cannot_access_other_tenant_work_order(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherChecklist = ServiceChecklist::create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Checklist Alheio',
            'is_active' => true,
        ]);
        $otherWorkOrder = WorkOrder::factory()->create([
            'tenant_id' => $otherTenant->id,
            'checklist_id' => $otherChecklist->id,
        ]);

        $response = $this->getJson("/api/v1/work-orders/{$otherWorkOrder->id}/checklist-responses");

        $response->assertNotFound();
    }
}
