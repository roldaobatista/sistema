<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\ServiceCall;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServiceCallTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;
    private User $technician;

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
        $this->technician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── CRUD ──

    public function test_create_service_call(): void
    {
        $response = $this->postJson('/api/v1/service-calls', [
            'customer_id' => $this->customer->id,
            'priority' => 'high', // Mantido string pois é chave do array PRIORITIES
            'observations' => 'Teste de chamado',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('priority', 'high');
    }

    public function test_list_service_calls(): void
    {
        ServiceCall::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson('/api/v1/service-calls');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_show_service_call(): void
    {
        $call = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson("/api/v1/service-calls/{$call->id}");

        $response->assertOk()
            ->assertJsonPath('id', $call->id);
    }

    public function test_update_status(): void
    {
        $call = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'technician_id' => $this->user->id,
            'status' => ServiceCall::STATUS_OPEN,
        ]);

        $response = $this->putJson("/api/v1/service-calls/{$call->id}/status", [
            'status' => ServiceCall::STATUS_SCHEDULED,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', ServiceCall::STATUS_SCHEDULED);
    }

    public function test_update_status_rejects_invalid_transition(): void
    {
        $call = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => ServiceCall::STATUS_OPEN,
        ]);

        $response = $this->putJson("/api/v1/service-calls/{$call->id}/status", [
            'status' => ServiceCall::STATUS_IN_PROGRESS,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'não permitida'));
    }

    public function test_map_data_supports_status_filter_and_payload_fields(): void
    {
        $call = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'technician_id' => $this->technician->id,
            'status' => ServiceCall::STATUS_OPEN,
            'latitude' => -23.5505,
            'longitude' => -46.6333,
            'observations' => 'Cliente sem energia',
        ]);

        ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => ServiceCall::STATUS_COMPLETED,
            'latitude' => -23.5600,
            'longitude' => -46.6400,
        ]);

        $response = $this->getJson('/api/v1/service-calls-map?status=' . ServiceCall::STATUS_OPEN);

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $call->id)
            ->assertJsonPath('0.description', 'Cliente sem energia')
            ->assertJsonPath('0.technician.id', $this->technician->id);
    }

    public function test_legacy_map_and_agenda_routes_are_available(): void
    {
        ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'technician_id' => $this->technician->id,
            'status' => ServiceCall::STATUS_SCHEDULED,
            'scheduled_date' => now()->toDateTimeString(),
            'latitude' => -23.5505,
            'longitude' => -46.6333,
        ]);

        $map = $this->getJson('/api/v1/service-calls/map-data');
        $agenda = $this->getJson('/api/v1/service-calls/agenda?technician_id=' . $this->technician->id . '&date_from=' . now()->subDay()->toDateString() . '&date_to=' . now()->addDay()->toDateString());

        $map->assertOk()->assertJsonCount(1);
        $agenda->assertOk()->assertJsonCount(1)->assertJsonPath('0.technician_id', $this->technician->id);
    }

    public function test_convert_to_work_order_requires_single_conversion(): void
    {
        $call = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => ServiceCall::STATUS_COMPLETED,
        ]);

        $first = $this->postJson("/api/v1/service-calls/{$call->id}/convert-to-os");

        $first->assertStatus(201)
            ->assertJsonPath('service_call_id', $call->id)
            ->assertJsonPath('created_by', $this->user->id);

        $this->assertDatabaseHas('work_orders', [
            'service_call_id' => $call->id,
            'created_by' => $this->user->id,
        ]);

        $second = $this->postJson("/api/v1/service-calls/{$call->id}/convert-to-os");

        $second->assertStatus(409)
            ->assertJsonPath('work_order.id', $first->json('id'))
            ->assertJsonPath('work_order.business_number', $first->json('business_number'));

        $this->assertEquals(1, WorkOrder::where('service_call_id', $call->id)->count());
    }

    // ── Tenant Isolation ──

    public function test_summary_returns_transit_and_in_service_breakdown(): void
    {
        ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => ServiceCall::STATUS_IN_TRANSIT,
        ]);

        ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => ServiceCall::STATUS_IN_PROGRESS,
        ]);

        $response = $this->getJson('/api/v1/service-calls-summary');

        $response->assertOk()
            ->assertJsonPath('in_transit', 1)
            ->assertJsonPath('in_progress', 1);
    }

    public function test_service_calls_isolated_by_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();

        ServiceCall::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => Customer::factory()->create(['tenant_id' => $otherTenant->id])->id,
            'observations' => 'Outro Tenant',
        ]);

        $myCall = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'observations' => 'Meu Tenant',
        ]);

        $response = $this->getJson('/api/v1/service-calls');

        $response->assertOk()
            ->assertSee('Meu Tenant')
            ->assertDontSee('Outro Tenant');
    }
}
