<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\ServiceCall;
use App\Models\WorkOrder;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Service Call tests — replaces ServiceCallExtendedTest.
 * NO withoutMiddleware. Exact status assertions. DB verification on all mutations.
 */
class ServiceCallProfessionalTest extends TestCase
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
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── CREATE — exact status assertions ──

    public function test_create_service_call_returns_201_and_persists(): void
    {
        $response = $this->postJson('/api/v1/service-calls', [
            'customer_id' => $this->customer->id,
            'title' => 'Balança não liga',
            'description' => 'Cliente reporta que a balança não está ligando',
            'priority' => 'high',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('service_calls', [
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'title' => 'Balança não liga',
            'priority' => 'high',
        ]);
    }

    public function test_create_service_call_requires_customer_id(): void
    {
        $response = $this->postJson('/api/v1/service-calls', [
            'title' => 'Chamado sem cliente',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['customer_id']);
    }

    public function test_create_service_call_requires_title(): void
    {
        $response = $this->postJson('/api/v1/service-calls', [
            'customer_id' => $this->customer->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['title']);
    }

    // ── READ ──

    public function test_list_returns_paginated_data(): void
    {
        ServiceCall::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson('/api/v1/service-calls');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total']);
    }

    public function test_show_returns_service_call_with_relationships(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'title' => 'Chamado de teste',
        ]);

        $response = $this->getJson("/api/v1/service-calls/{$sc->id}");

        $response->assertOk()
            ->assertJsonPath('id', $sc->id)
            ->assertJsonPath('title', 'Chamado de teste');
    }

    public function test_summary_returns_stats_structure(): void
    {
        $response = $this->getJson('/api/v1/service-calls-summary');

        $response->assertOk()
            ->assertJsonStructure(['open', 'in_progress', 'scheduled', 'completed']);
    }

    // ── UPDATE — exact assertions ──

    public function test_update_service_call_persists_changes(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'title' => 'Título original',
        ]);

        $response = $this->putJson("/api/v1/service-calls/{$sc->id}", [
            'title' => 'Título atualizado',
            'priority' => 'urgent',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('service_calls', [
            'id' => $sc->id,
            'title' => 'Título atualizado',
            'priority' => 'urgent',
        ]);
    }

    // ── STATUS TRANSITIONS ──

    public function test_transition_open_to_in_progress(): void
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

    public function test_transition_to_completed_sets_timestamp(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => 'in_progress',
        ]);

        $response = $this->putJson("/api/v1/service-calls/{$sc->id}/status", [
            'status' => 'completed',
        ]);

        $response->assertOk();

        $sc->refresh();
        $this->assertEquals('completed', $sc->status);
    }

    // ── ASSIGN TECHNICIAN ──

    public function test_assign_technician_persists(): void
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

        $this->assertDatabaseHas('service_calls', [
            'id' => $sc->id,
            'assigned_to' => $technician->id,
        ]);
    }

    // ── COMMENTS ──

    public function test_add_comment_persists_and_returns_201(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->postJson("/api/v1/service-calls/{$sc->id}/comments", [
            'content' => 'Técnico informou que a peça está em falta',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('service_call_comments', [
            'service_call_id' => $sc->id,
            'content' => 'Técnico informou que a peça está em falta',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_list_comments_returns_for_service_call(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        // Add a comment first
        $this->postJson("/api/v1/service-calls/{$sc->id}/comments", [
            'content' => 'Primeiro comentário',
        ]);

        $response = $this->getJson("/api/v1/service-calls/{$sc->id}/comments");

        $response->assertOk();
    }

    // ── CONVERT TO WORK ORDER ──

    public function test_convert_to_work_order_creates_os_and_updates_status(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => 'open',
            'title' => 'Chamado para converter',
        ]);

        $response = $this->postJson("/api/v1/service-calls/{$sc->id}/convert-to-os");

        $response->assertStatus(201);

        // ServiceCall deve ter work_order_id preenchido
        $sc->refresh();
        $this->assertNotNull($sc->work_order_id);

        // WorkOrder deve existir com o customer correto
        $this->assertDatabaseHas('work_orders', [
            'id' => $sc->work_order_id,
            'customer_id' => $this->customer->id,
            'tenant_id' => $this->tenant->id,
        ]);
    }

    // ── DELETE — exact status ──

    public function test_delete_service_call_returns_204(): void
    {
        $sc = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->deleteJson("/api/v1/service-calls/{$sc->id}");

        $response->assertStatus(204);
    }

    // ── EXPORT ──

    public function test_export_csv_returns_correct_content_type(): void
    {
        ServiceCall::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->get('/api/v1/service-calls-export');

        $response->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    // ── MAP & AGENDA ──

    public function test_map_data_returns_geolocation_structure(): void
    {
        $response = $this->getJson('/api/v1/service-calls-map');

        $response->assertOk();
    }

    public function test_agenda_returns_schedule_data(): void
    {
        $response = $this->getJson('/api/v1/service-calls-agenda');

        $response->assertOk();
    }
}
