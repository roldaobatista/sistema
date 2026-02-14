<?php

namespace Tests\Feature;

use App\Models\ExpenseCategory;
use App\Models\Expense;
use App\Models\TechnicianCashFund;
use App\Models\Customer;
use App\Models\WorkOrder;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExpenseTest extends TestCase
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

    public function test_store_rejects_category_from_other_tenant(): void
    {
        $foreignCategory = ExpenseCategory::create([
            'tenant_id' => Tenant::factory()->create()->id,
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

    public function test_store_creates_with_pending_status(): void
    {
        $response = $this->postJson('/api/v1/expenses', [
            'description' => 'Material de escritorio',
            'amount' => 55.90,
            'expense_date' => now()->toDateString(),
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', Expense::STATUS_PENDING);

        $this->assertDatabaseHas('expenses', [
            'id' => $response->json('id'),
            'status' => Expense::STATUS_PENDING,
        ]);
    }

    public function test_show_blocks_cross_tenant_expense(): void
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
        $response->assertStatus(404);
    }

    public function test_update_blocks_approved_expense(): void
    {
        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Aluguel',
            'amount' => 300,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_APPROVED,
        ]);

        $this->putJson("/api/v1/expenses/{$expense->id}", [
            'description' => 'Tentativa de alterar',
        ])->assertStatus(422);
    }

    public function test_delete_blocks_cross_tenant_expense(): void
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

    public function test_expense_returns_os_identifier_when_linked_to_work_order(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BL-7788',
            'number' => 'OS-000123',
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrder->id,
            'created_by' => $this->user->id,
            'description' => 'Combustivel da visita',
            'amount' => 150.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        $this->getJson('/api/v1/expenses')
            ->assertOk()
            ->assertJsonPath('data.0.work_order.os_number', 'BL-7788');

        $this->getJson("/api/v1/expenses/{$expense->id}")
            ->assertOk()
            ->assertJsonPath('work_order.os_number', 'BL-7788');
    }

    public function test_reimbursed_expense_returns_value_to_technician_cash(): void
    {
        $approver = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Adiantamento de campo',
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

        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_REIMBURSED,
        ])->assertOk();

        $this->assertSame(0.0, (float) $fund->fresh()->balance);
    }

    public function test_rejecting_expense_requires_and_persists_reason(): void
    {
        $approver = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Compra sem comprovante',
            'amount' => 90.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        Sanctum::actingAs($approver, ['*']);

        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_REJECTED,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['rejection_reason']);

        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_REJECTED,
            'rejection_reason' => 'Documento fiscal ausente',
        ])->assertOk()
            ->assertJsonPath('status', Expense::STATUS_REJECTED)
            ->assertJsonPath('rejection_reason', 'Documento fiscal ausente');
    }

    public function test_update_status_blocks_cross_tenant_expense(): void
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

        $response = $this->putJson("/api/v1/expenses/{$foreignExpense->id}/status", [
            'status' => Expense::STATUS_APPROVED,
        ]);
        $response->assertStatus(404);
    }

    public function test_destroy_category_blocked_when_expenses_exist(): void
    {
        $category = ExpenseCategory::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Alimentacao',
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
    }

    public function test_store_category_rejects_duplicate_name_same_tenant(): void
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

    public function test_update_category_rejects_duplicate_name_same_tenant(): void
    {
        $cat1 = ExpenseCategory::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Alimentacao',
            'color' => '#ff0000',
            'active' => true,
        ]);

        $cat2 = ExpenseCategory::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Transporte',
            'color' => '#00ff00',
            'active' => true,
        ]);

        $this->putJson("/api/v1/expense-categories/{$cat2->id}", [
            'name' => 'Alimentacao',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        // Same name to itself should be allowed
        $this->putJson("/api/v1/expense-categories/{$cat1->id}", [
            'name' => 'Alimentacao',
        ])->assertOk();
    }

    public function test_update_category_blocks_cross_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignCategory = ExpenseCategory::create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Hospedagem',
            'color' => '#aaaaaa',
            'active' => true,
        ]);

        $response = $this->putJson("/api/v1/expense-categories/{$foreignCategory->id}", [
            'name' => 'Tentativa',
        ]);
        $response->assertStatus(404);
    }

    public function test_summary_returns_correct_totals(): void
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
        // month_total should exclude rejected
        $this->assertEquals(300.0, $response->json('month_total'));
    }

    public function test_delete_blocked_for_approved_expense(): void
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
    }

    public function test_rejected_expense_clears_approved_by(): void
    {
        $approver = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Para rejeitar',
            'amount' => 80.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        Sanctum::actingAs($approver, ['*']);

        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_REJECTED,
            'rejection_reason' => 'Sem comprovante',
        ])->assertOk();

        $this->assertNull($expense->fresh()->approved_by);
    }

    public function test_rejected_expense_can_be_resubmitted_as_pending(): void
    {
        $approver = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Despesa para resubmeter',
            'amount' => 120.00,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
        ]);

        Sanctum::actingAs($approver, ['*']);

        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_REJECTED,
            'rejection_reason' => 'Falta comprovante',
        ])->assertOk();

        $this->assertSame(Expense::STATUS_REJECTED, $expense->fresh()->status);

        // Resubmit as pending
        $this->putJson("/api/v1/expenses/{$expense->id}/status", [
            'status' => Expense::STATUS_PENDING,
        ])->assertOk();

        $this->assertSame(Expense::STATUS_PENDING, $expense->fresh()->status);
        $this->assertNull($expense->fresh()->rejection_reason);
    }

    public function test_store_defaults_affects_net_value_to_true(): void
    {
        $response = $this->postJson('/api/v1/expenses', [
            'description' => 'Despesa sem flag explicito',
            'amount' => 75.00,
            'expense_date' => now()->toDateString(),
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('expenses', [
            'id' => $response->json('id'),
            'affects_net_value' => true,
        ]);
    }

    public function test_store_persists_affects_net_value_false(): void
    {
        $response = $this->postJson('/api/v1/expenses', [
            'description' => 'Despesa nao dedutivel',
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

    public function test_update_toggles_affects_net_value(): void
    {
        $expense = Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Despesa editavel',
            'amount' => 80,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_PENDING,
            'affects_net_value' => true,
        ]);

        $this->putJson("/api/v1/expenses/{$expense->id}", [
            'affects_net_value' => false,
        ])->assertOk();

        $this->assertFalse((bool) $expense->fresh()->affects_net_value);
    }
}
