<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\TechnicianCashFund;
use App\Models\TechnicianCashTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TechnicianCashTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
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

        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $this->technician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->technician->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_credit_creates_fund_and_transaction(): void
    {
        $response = $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $this->technician->id,
            'amount' => 500,
            'description' => 'Verba operacional',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('technician_cash_funds', [
            'user_id' => $this->technician->id,
            'tenant_id' => $this->tenant->id,
            'balance' => '500.00',
        ]);

        $this->assertDatabaseHas('technician_cash_transactions', [
            'type' => 'credit',
            'amount' => '500.00',
            'balance_after' => '500.00',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_debit_reduces_balance(): void
    {
        // Primeiro, adicionar crédito
        $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $this->technician->id,
            'amount' => 300,
            'description' => 'Verba inicial',
        ]);

        $response = $this->postJson('/api/v1/technician-cash/debit', [
            'user_id' => $this->technician->id,
            'amount' => 100,
            'description' => 'Compra de material',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('technician_cash_funds', [
            'user_id' => $this->technician->id,
            'balance' => '200.00',
        ]);
    }

    public function test_debit_rejects_insufficient_balance(): void
    {
        // Criar fundo com saldo zero
        TechnicianCashFund::getOrCreate($this->technician->id, $this->tenant->id);

        $response = $this->postJson('/api/v1/technician-cash/debit', [
            'user_id' => $this->technician->id,
            'amount' => 100,
            'description' => 'Sem saldo',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['amount']);
    }

    public function test_credit_uses_current_tenant_context_after_switch(): void
    {
        $secondTenant = Tenant::factory()->create();
        $this->user->tenants()->attach($secondTenant->id, ['is_default' => false]);
        $this->user->update(['current_tenant_id' => $secondTenant->id]);
        app()->instance('current_tenant_id', $secondTenant->id);

        $technician = User::factory()->create([
            'tenant_id' => $secondTenant->id,
            'current_tenant_id' => $secondTenant->id,
            'is_active' => true,
        ]);
        $technician->tenants()->attach($secondTenant->id, ['is_default' => true]);

        $response = $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $technician->id,
            'amount' => 150,
            'description' => 'Adiantamento operacional',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('technician_cash_funds', [
            'user_id' => $technician->id,
            'tenant_id' => $secondTenant->id,
        ]);

        $this->assertDatabaseMissing('technician_cash_funds', [
            'user_id' => $technician->id,
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_credit_rejects_technician_from_other_tenant(): void
    {
        $foreignTenant = Tenant::factory()->create();
        $foreignUser = User::factory()->create([
            'tenant_id' => $foreignTenant->id,
            'current_tenant_id' => $foreignTenant->id,
        ]);

        $response = $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $foreignUser->id,
            'amount' => 200,
            'description' => 'Nao permitido',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['user_id']);
    }

    public function test_show_returns_fund_and_transactions(): void
    {
        $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $this->technician->id,
            'amount' => 250,
            'description' => 'Verba teste',
        ]);

        $response = $this->getJson("/api/v1/technician-cash/{$this->technician->id}");

        $response->assertOk()
            ->assertJsonPath('fund.user_id', $this->technician->id)
            ->assertJsonPath('fund.balance', '250.00');
    }

    public function test_show_rejects_user_from_other_tenant(): void
    {
        $foreignTenant = Tenant::factory()->create();
        $foreignUser = User::factory()->create([
            'tenant_id' => $foreignTenant->id,
            'current_tenant_id' => $foreignTenant->id,
        ]);

        $response = $this->getJson("/api/v1/technician-cash/{$foreignUser->id}");

        $response->assertStatus(404);
    }

    public function test_summary_returns_correct_totals(): void
    {
        // Crédito + Débito
        $this->postJson('/api/v1/technician-cash/credit', [
            'user_id' => $this->technician->id,
            'amount' => 1000,
            'description' => 'Verba mensal',
        ]);
        $this->postJson('/api/v1/technician-cash/debit', [
            'user_id' => $this->technician->id,
            'amount' => 300,
            'description' => 'Compra peças',
        ]);

        $response = $this->getJson('/api/v1/technician-cash-summary');

        $response->assertOk();

        $data = $response->json();
        $this->assertEquals(700, $data['total_balance']);
        $this->assertEquals(1000, $data['month_credits']);
        $this->assertEquals(300, $data['month_debits']);
        $this->assertEquals(1, $data['funds_count']);
    }

    public function test_index_lists_all_funds(): void
    {
        TechnicianCashFund::getOrCreate($this->technician->id, $this->tenant->id);

        $response = $this->getJson('/api/v1/technician-cash');

        $response->assertOk()
            ->assertJsonCount(1);
    }

    public function test_show_filters_transactions_by_date_and_pagination(): void
    {
        $fund = TechnicianCashFund::getOrCreate($this->technician->id, $this->tenant->id);

        // Criar transação antiga
        TechnicianCashTransaction::factory()->create([
            'fund_id' => $fund->id,
            'tenant_id' => $this->tenant->id,
            'type' => 'credit',
            'amount' => 100,
            'balance_after' => 100,
            'transaction_date' => now()->subDays(10)->toDateString(),
            'description' => 'Antiga',
        ]);
        // Criar transação recente
        TechnicianCashTransaction::factory()->create([
            'fund_id' => $fund->id,
            'tenant_id' => $this->tenant->id,
            'type' => 'debit',
            'amount' => 50,
            'balance_after' => 50,
            'transaction_date' => now()->toDateString(),
            'description' => 'Recente',
        ]);

        // Filtro Data
        $response = $this->getJson("/api/v1/technician-cash/{$this->technician->id}?date_from=" . now()->toDateString());
        $response->assertOk();
        $this->assertCount(1, $response->json('transactions.data'));
        $this->assertEquals('Recente', $response->json('transactions.data.0.description'));

        // Paginação
        $responsePag = $this->getJson("/api/v1/technician-cash/{$this->technician->id}?per_page=1");
        $responsePag->assertOk();
        $this->assertEquals(1, $responsePag->json('transactions.per_page'));
        $this->assertEquals(2, $responsePag->json('transactions.total'));
    }
}
