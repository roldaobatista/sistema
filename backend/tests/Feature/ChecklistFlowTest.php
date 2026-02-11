<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\ServiceChecklist;
use App\Models\ServiceChecklistItem;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChecklistFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_service_checklist_store_uses_current_tenant_context(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        $user = User::factory()->create([
            'tenant_id' => $tenantA->id,
            'current_tenant_id' => $tenantB->id,
            'is_active' => true,
        ]);

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);
        app()->instance('current_tenant_id', $tenantB->id);
        Sanctum::actingAs($user, ['*']);

        $response = $this->postJson('/api/v1/service-checklists', [
            'name' => 'Checklist Contexto Tenant',
            'items' => [
                [
                    'description' => 'Validar lacre',
                    'type' => 'check',
                ],
            ],
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('service_checklists', [
            'name' => 'Checklist Contexto Tenant',
            'tenant_id' => $tenantB->id,
        ]);

        $this->assertDatabaseMissing('service_checklists', [
            'name' => 'Checklist Contexto Tenant',
            'tenant_id' => $tenantA->id,
        ]);
    }

    public function test_checklist_responses_reject_item_not_from_work_order_checklist(): void
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'current_tenant_id' => $tenant->id,
            'is_active' => true,
        ]);
        $customer = Customer::factory()->create(['tenant_id' => $tenant->id]);

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);
        app()->instance('current_tenant_id', $tenant->id);
        Sanctum::actingAs($user, ['*']);

        $checklistA = ServiceChecklist::create([
            'tenant_id' => $tenant->id,
            'name' => 'Checklist A',
            'is_active' => true,
        ]);
        $checklistB = ServiceChecklist::create([
            'tenant_id' => $tenant->id,
            'name' => 'Checklist B',
            'is_active' => true,
        ]);

        $itemFromOtherChecklist = ServiceChecklistItem::create([
            'checklist_id' => $checklistB->id,
            'description' => 'Item externo',
            'type' => 'check',
            'is_required' => false,
            'order_index' => 1,
        ]);

        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $user->id,
            'checklist_id' => $checklistA->id,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$workOrder->id}/checklist-responses", [
            'responses' => [
                [
                    'checklist_item_id' => $itemFromOtherChecklist->id,
                    'value' => 'true',
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Um ou mais itens não pertencem ao checklist desta OS.');
    }
}

