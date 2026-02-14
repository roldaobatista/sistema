<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\TechnicianCashFund;
use App\Models\Customer;
use App\Models\WorkOrder;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Expense tests — replaces the assertContains patterns in ExpenseTest.
 * Exact status code assertions, full DB verification, business logic validation.
 */
class ExpenseProfessionalTest extends TestCase
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

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── CREATE ──

    public function test_create_expense_sets_pending_and_persists_all_fields(): void
    {
        $category = ExpenseCategory::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Combustível',
            'color' => '#FF6600',
            'active' => true,
        ]);

        $response = $this->postJson('/api/v1/expenses', [
            'expense_category_id' => $category->id,
            'description' => 'Viagem ao cliente ABC',
            'amount' => 250.75,
            'expense_date' => '2026-02-13',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', Expense::STATUS_PENDING)
            ->assertJsonPath('description', 'Viagem ao cliente ABC');

        $this->assertDatabaseHas('expenses', [
            'id' => $response->json('id'),
            'tenant_id' => $this->tenant->id,
            'description' => 'Viagem ao cliente ABC',
            'amount' => 250.75,
            'status' => Expense::STATUS_PENDING,
            'expense_category_id' => $category->id,
        ]);
    }

    public function test_create_expense_defaults_affects_net_value_to_true(): void
    {
        $response = $this->postJson('/api/v1/expenses', [
            'description' => 'Despesa sem flag',
            'amount' => 75.00,
            'expense_date' => now()->toDateString(),
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('expenses', [
            'id' => $response->json('id'),
            'affects_net_value' => true,
        ]);
    }

    public function test_create_expense_with_affects_net_value_false(): void
    {
        $response = $this->postJson('/api/v1/expenses', [
            'description' => 'Despesa não dedutível',
            'amount' => 120.00,
            'expense_date' => now()->toDateString(),
            'affects_net_value' => false,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('expenses', [
            'id' => $response->json('id'),
            'affects_net_value' => false,
        ]);
    }

    // ── VALIDATION ──

    public function test_create_rejects_category_from_other_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignCategory = ExpenseCategory::create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Viagem',
            'color' => '#cccccc',
            'active' => true,
        ]);

        $response = $this->postJson('/api/v1/expenses', [
            'expense_category_id' => $foreignCategory->id,
            'description' => 'Taxi',
            'amount' => 120,
            'expense_date' => now()->toDateString(),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['expense_category_id']);
    }

    // ── STATUS WORKFLOW ──

    public function test_approve_expense_changes_status_and_sets_approver(): void
    {
        $approver = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Material',
            'amount' => 300,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        Sanctum::actingAs($approver, ['*']);

        $response = $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_APPROVED,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', Expense::STATUS_APPROVED);

        $expense->refresh();
        $this->assertEquals(Expense::STATUS_APPROVED, $expense->status);
        $this->assertEquals($approver->id, $expense->approved_by);
    }

    public function test_reject_requires_reason(): void
    {
        $approver = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Sem comprovante',
            'amount' => 90.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        Sanctum::actingAs($approver, ['*']);

        // Without reason — should fail
        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_REJECTED,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['rejection_reason']);

        // With reason — should succeed
        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_REJECTED,
            'rejection_reason' => 'Documento fiscal ausente',
        ])->assertOk()
            ->assertJsonPath('status', Expense::STATUS_REJECTED)
            ->assertJsonPath('rejection_reason', 'Documento fiscal ausente');

        $expense->refresh();
        $this->assertNull($expense->approved_by);
    }

    public function test_rejected_expense_can_be_resubmitted_and_clears_reason(): void
    {
        $approver = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Despesa rejeitada',
            'amount' => 120.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        Sanctum::actingAs($approver, ['*']);

        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_REJECTED,
            'rejection_reason' => 'Falta comprovante',
        ])->assertOk();

        $this->assertEquals(Expense::STATUS_REJECTED, $expense->fresh()->status);

        // Resubmit
        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_PENDING,
        ])->assertOk();

        $expense->refresh();
        $this->assertEquals(Expense::STATUS_PENDING, $expense->status);
        $this->assertNull($expense->rejection_reason);
    }

    // ── BUSINESS LOGIC: Technician Cash ──

    public function test_approved_expense_with_cash_flag_debits_technician_fund(): void
    {
        $approver = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Adiantamento campo',
            'amount' => 200.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
            'affects_technician_cash' => true,
        ]);

        Sanctum::actingAs($approver, ['*']);

        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_APPROVED,
        ])->assertOk();

        $fund = TechnicianCashFund::where('tenant_id', $this->tenant->id)
            ->where('user_id', $this->user->id)
            ->first();

        $this->assertNotNull($fund);
        $this->assertSame(-200.0, (float) $fund->balance);

        // Reimburse — should restore balance
        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_REIMBURSED,
        ])->assertOk();

        $this->assertSame(0.0, (float) $fund->fresh()->balance);
    }

    // ── GUARD CLAUSES ──

    public function test_update_blocks_approved_expense(): void
    {
        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Já aprovada',
            'amount' => 300,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_APPROVED,
        ]);

        $this->putJson("/api/v1/expenses/{$expense->id}", [
            'description' => 'Tentativa de alterar',
        ])->assertStatus(422);

        // Data should NOT have changed
        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'description' => 'Já aprovada',
        ]);
    }

    public function test_delete_blocks_approved_expense(): void
    {
        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Aprovada',
            'amount' => 500,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_APPROVED,
        ]);

        $this->deleteJson("/api/v1/expenses/{$expense->id}")
            ->assertStatus(422);

        $this->assertDatabaseHas('expenses', ['id' => $expense->id]);
    }

    // ── CROSS-TENANT: exact 404 ──

    public function test_show_cross_tenant_expense_returns_404(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignExpense = Expense::create([
            'tenant_id' => $otherTenant->id,
            'created_by' => User::factory()->create(['tenant_id' => $otherTenant->id, 'current_tenant_id' => $otherTenant->id])->id,
            'description' => 'Despesa alheia',
            'amount' => 100,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        $response = $this->getJson("/api/v1/expenses/{$foreignExpense->id}");

        // Should be 404 due to tenant scope
        $response->assertStatus(404);
    }

    public function test_delete_cross_tenant_expense_returns_404(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignExpense = Expense::create([
            'tenant_id' => $otherTenant->id,
            'created_by' => User::factory()->create(['tenant_id' => $otherTenant->id, 'current_tenant_id' => $otherTenant->id])->id,
            'description' => 'Despesa alheia',
            'amount' => 50,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        $response = $this->deleteJson("/api/v1/expenses/{$foreignExpense->id}");

        $response->assertStatus(404);
    }

    // ── SUMMARY ──

    public function test_summary_returns_exact_totals(): void
    {
        Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Pendente 1',
            'amount' => 100.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);
        Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Aprovada 1',
            'amount' => 200.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_APPROVED,
        ]);
        Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Rejeitada 1',
            'amount' => 50.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_REJECTED,
        ]);

        $response = $this->getJson('/api/v1/expense-summary')
            ->assertOk();

        $this->assertEquals(100.0, $response->json('pending'));
        $this->assertEquals(200.0, $response->json('approved'));
        $this->assertEquals(300.0, $response->json('month_total'));
    }

    // ── CATEGORY GUARD ──

    public function test_destroy_category_blocked_when_has_linked_expenses(): void
    {
        $category = ExpenseCategory::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Alimentação',
            'color' => '#ff0000',
            'active' => true,
        ]);

        Expense::create([
            'tenant_id' => $this->tenant->id,
            'expense_category_id' => $category->id,
            'created_by' => $this->user->id,
            'description' => 'Almoço',
            'amount' => 35,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        $this->deleteJson("/api/v1/expense-categories/{$category->id}")
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Categoria possui despesas vinculadas. Remova ou reclassifique antes de excluir.']);

        $this->assertDatabaseHas('expense_categories', ['id' => $category->id]);
    }

    public function test_category_duplicate_name_rejected_same_tenant(): void
    {
        ExpenseCategory::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Transporte',
            'color' => '#00ff00',
            'active' => true,
        ]);

        $this->postJson('/api/v1/expense-categories', [
            'name' => 'Transporte',
            'color' => '#0000ff',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    // ── LINKED TO WORK ORDER ──

    public function test_expense_with_work_order_returns_os_identifier(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BL-7788',
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrder->id,
            'created_by' => $this->user->id,
            'description' => 'Combustível da visita',
            'amount' => 150.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        $this->getJson("/api/v1/expenses/{$expense->id}")
            ->assertOk()
            ->assertJsonPath('work_order.os_number', 'BL-7788');
    }
}
