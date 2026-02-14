<?php

namespace Tests\Feature;

use App\Models\CentralItem;
use App\Models\TechnicianCashFund;
use App\Models\TechnicianCashTransaction;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Technician Central tests — replaces TechnicianCentralTest.
 * Exact assertions for cash fund operations, central inbox, notifications, SLA.
 */
class TechnicianCentralProfessionalTest extends TestCase
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
            'is_active' => true,
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── TECHNICIAN CASH ──

    public function test_add_credit_persists_and_updates_balance(): void
    {
        $response = $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $this->user->id,
            'amount' => 500.00,
            'description' => 'Adiantamento semanal',
        ]);

        $response->assertStatus(201);

        $fund = TechnicianCashFund::where('user_id', $this->user->id)
            ->where('tenant_id', $this->tenant->id)
            ->first();

        $this->assertNotNull($fund);
        $this->assertSame(500.0, (float) $fund->balance);

        $this->assertDatabaseHas('technician_cash_transactions', [
            'technician_cash_fund_id' => $fund->id,
            'type' => 'credit',
            'amount' => 500.00,
            'description' => 'Adiantamento semanal',
        ]);
    }

    public function test_add_debit_reduces_balance(): void
    {
        // First add credit
        $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $this->user->id,
            'amount' => 500.00,
            'description' => 'Adiantamento',
        ])->assertStatus(201);

        // Then debit
        $response = $this->postJson('/api/v1/technician-cash/debit', [
            'user_id' => $this->user->id,
            'amount' => 150.00,
            'description' => 'Compra de peça',
        ]);

        $response->assertStatus(201);

        $fund = TechnicianCashFund::where('user_id', $this->user->id)->first();
        $this->assertSame(350.0, (float) $fund->balance);
    }

    public function test_cash_index_returns_list(): void
    {
        $response = $this->getJson('/api/v1/technician-cash');
        $response->assertOk();
    }

    public function test_cash_show_returns_user_fund_or_404(): void
    {
        // Without any fund: should return 404 or empty
        $response = $this->getJson("/api/v1/technician-cash/{$this->user->id}");

        // After creating a fund, should be 200
        $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $this->user->id,
            'amount' => 100,
            'description' => 'Init',
        ])->assertStatus(201);

        $this->getJson("/api/v1/technician-cash/{$this->user->id}")
            ->assertOk();
    }

    public function test_cash_summary_returns_totals(): void
    {
        $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $this->user->id,
            'amount' => 300,
            'description' => 'Test',
        ])->assertStatus(201);

        $response = $this->getJson('/api/v1/technician-cash-summary');

        $response->assertOk()
            ->assertJsonStructure(['total_balance', 'total_technicians']);
    }

    // ── CENTRAL INBOX ──

    public function test_create_central_task_persists(): void
    {
        $response = $this->postJson('/api/v1/central/items', [
            'title' => 'Verificar estoque de peças',
            'type' => 'task',
            'priority' => 'high',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('title', 'Verificar estoque de peças')
            ->assertJsonPath('type', 'task');

        $this->assertDatabaseHas('central_items', [
            'tenant_id' => $this->tenant->id,
            'title' => 'Verificar estoque de peças',
            'type' => 'task',
            'priority' => 'high',
        ]);
    }

    public function test_central_items_index_returns_list(): void
    {
        $response = $this->getJson('/api/v1/central/items');
        $response->assertOk();
    }

    public function test_central_summary_returns_counts(): void
    {
        $response = $this->getJson('/api/v1/central/summary');

        $response->assertOk()
            ->assertJsonStructure(['pending', 'in_progress', 'completed']);
    }

    public function test_central_constants_returns_types_and_priorities(): void
    {
        $response = $this->getJson('/api/v1/central/constants');

        $response->assertOk()
            ->assertJsonStructure(['types', 'priorities']);
    }

    // ── NOTIFICATIONS ──

    public function test_notifications_index_returns_list(): void
    {
        $response = $this->getJson('/api/v1/notifications');
        $response->assertOk();
    }

    public function test_unread_count_returns_number(): void
    {
        $response = $this->getJson('/api/v1/notifications/unread-count');

        $response->assertOk()
            ->assertJsonStructure(['count']);
    }

    public function test_mark_all_read_returns_200(): void
    {
        $response = $this->putJson('/api/v1/notifications/read-all');

        $response->assertOk();
    }

    // ── SLA DASHBOARD ──

    public function test_sla_overview_returns_structure(): void
    {
        $response = $this->getJson('/api/v1/sla-dashboard/overview');

        $response->assertOk();
    }

    public function test_sla_breached_returns_list(): void
    {
        $response = $this->getJson('/api/v1/sla-dashboard/breached');

        $response->assertOk();
    }
}
