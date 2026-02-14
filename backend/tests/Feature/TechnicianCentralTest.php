<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Technician Cash & Central Module Tests — validates caixa do técnico,
 * central inbox, notifications, and scheduling endpoints.
 */
class TechnicianCentralTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;

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

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── TECHNICIAN CASH BOX ──

    public function test_technician_cash_index(): void
    {
        $response = $this->getJson('/api/v1/technician-cash');
        $response->assertOk();
    }

    public function test_technician_cash_show_for_user(): void
    {
        $response = $this->getJson("/api/v1/technician-cash/{$this->user->id}");
        $response->assertOk();
    }

    public function test_technician_cash_summary(): void
    {
        $response = $this->getJson('/api/v1/technician-cash-summary');
        $response->assertOk();
    }

    public function test_add_credit_to_technician(): void
    {
        $response = $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $this->user->id,
            'amount' => 500.00,
            'description' => 'Adiantamento semanal',
        ]);

        $response->assertCreated();
    }

    public function test_add_debit_to_technician(): void
    {
        $response = $this->postJson('/api/v1/technician-cash/debit', [
            'user_id' => $this->user->id,
            'amount' => 150.00,
            'description' => 'Compra de peça',
        ]);

        $response->assertCreated();
    }

    // ── CENTRAL INBOX ──

    public function test_central_summary(): void
    {
        $response = $this->getJson('/api/v1/central/summary');
        $response->assertOk();
    }

    public function test_central_constants(): void
    {
        $response = $this->getJson('/api/v1/central/constants');
        $response->assertOk();
    }

    public function test_central_items_index(): void
    {
        $response = $this->getJson('/api/v1/central/items');
        $response->assertOk();
    }

    public function test_central_create_task(): void
    {
        $response = $this->postJson('/api/v1/central/items', [
            'title' => 'Tarefa de teste',
            'type' => 'task',
            'priority' => 'medium',
        ]);

        $response->assertCreated();
    }

    // ── NOTIFICATIONS ──

    public function test_notifications_index(): void
    {
        $response = $this->getJson('/api/v1/notifications');
        $response->assertOk();
    }

    public function test_notifications_unread_count(): void
    {
        $response = $this->getJson('/api/v1/notifications/unread-count');
        $response->assertOk();
    }

    public function test_mark_all_notifications_read(): void
    {
        $response = $this->putJson('/api/v1/notifications/read-all');
        $response->assertOk();
    }

    // ── SCHEDULE ──

    public function test_schedule_conflicts(): void
    {
        $response = $this->getJson('/api/v1/schedules/conflicts');
        $response->assertOk();
    }

    public function test_schedule_workload(): void
    {
        $response = $this->getJson('/api/v1/schedules/workload');
        $response->assertOk();
    }

    // ── SLA DASHBOARD ──

    public function test_sla_dashboard_overview(): void
    {
        $response = $this->getJson('/api/v1/sla-dashboard/overview');
        $response->assertOk();
    }

    public function test_sla_breached_orders(): void
    {
        $response = $this->getJson('/api/v1/sla-dashboard/breached');
        $response->assertOk();
    }

    // ── EXTERNAL APIs ──

    public function test_external_states_returns_list(): void
    {
        $response = $this->getJson('/api/v1/external/states');
        $response->assertOk();
    }
}
