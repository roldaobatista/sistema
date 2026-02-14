<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\ServiceCall;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Service Call Extended Tests — validates CRUD, status transitions,
 * comments, map data, agenda, export, and conversion to work order.
 */
class ServiceCallExtendedTest extends TestCase
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
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── LIST ──

    public function test_service_calls_index_returns_list(): void
    {
        $response = $this->getJson('/api/v1/service-calls');
        $response->assertOk();
    }

    public function test_service_calls_summary_returns_stats(): void
    {
        $response = $this->getJson('/api/v1/service-calls-summary');
        $response->assertOk();
    }

    public function test_service_calls_map_data_returns_data(): void
    {
        $response = $this->getJson('/api/v1/service-calls-map');
        $response->assertOk();
    }

    public function test_service_calls_agenda_returns_schedule(): void
    {
        $response = $this->getJson('/api/v1/service-calls-agenda');
        $response->assertOk();
    }

    public function test_service_calls_assignees_returns_users(): void
    {
        $response = $this->getJson('/api/v1/service-calls-assignees');
        $response->assertOk();
    }

    public function test_service_calls_export_csv(): void
    {
        $response = $this->getJson('/api/v1/service-calls-export');
        $response->assertOk();
    }

    // ── CREATE ──

    public function test_create_service_call_with_valid_data(): void
    {
        $response = $this->postJson('/api/v1/service-calls', [
            'customer_id' => $this->customer->id,
            'title' => 'Balança não liga',
            'description' => 'Cliente reporta que a balança não está ligando',
            'priority' => 'high',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('service_calls', [
            'customer_id' => $this->customer->id,
            'title' => 'Balança não liga',
        ]);
    }

    public function test_create_service_call_requires_customer(): void
    {
        $response = $this->postJson('/api/v1/service-calls', [
            'title' => 'Chamado sem cliente',
        ]);

        $response->assertStatus(422);
    }

    // ── UPDATE & STATUS ──

    public function test_update_service_call(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->putJson("/api/v1/service-calls/{$sc->id}", [
            'title' => 'Título atualizado',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('service_calls', [
            'id' => $sc->id,
            'title' => 'Título atualizado',
        ]);
    }

    public function test_update_service_call_status(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => 'open',
        ]);

        $response = $this->putJson("/api/v1/service-calls/{$sc->id}/status", [
            'status' => 'in_progress',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('service_calls', [
            'id' => $sc->id,
            'status' => 'in_progress',
        ]);
    }

    // ── COMMENTS ──

    public function test_list_comments_for_service_call(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson("/api/v1/service-calls/{$sc->id}/comments");
        $response->assertOk();
    }

    public function test_add_comment_to_service_call(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->postJson("/api/v1/service-calls/{$sc->id}/comments", [
            'content' => 'Técnico informou que a peça está em falta',
        ]);

        $response->assertCreated();
    }

    // ── ASSIGN ──

    public function test_assign_technician_to_service_call(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $technician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $technician->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $response = $this->putJson("/api/v1/service-calls/{$sc->id}/assign", [
            'assigned_to' => $technician->id,
        ]);

        $response->assertOk();
    }

    // ── CONVERT TO WORK ORDER ──

    public function test_convert_service_call_to_work_order(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->postJson("/api/v1/service-calls/{$sc->id}/convert-to-os");

        $response->assertCreated();
    }

    // ── DELETE ──

    public function test_delete_service_call(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->deleteJson("/api/v1/service-calls/{$sc->id}");

        $response->assertNoContent();
    }
}
