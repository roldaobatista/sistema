<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExpenseFullCrudTest extends TestCase
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

    private function createExpense(array $attributes = [], string $status = Expense::STATUS_PENDING): Expense
    {
        $expense = new Expense(array_diff_key($attributes, ['status' => 1]));
        $expense->forceFill(['status' => $status]);
        $expense->save();
        return $expense;
    }

    public function test_can_list_expenses(): void
    {
        Expense::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/expenses');

        $response->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_can_filter_expenses_by_status(): void
    {
        $this->createExpense([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'amount' => 10,
            'expense_date' => now()->toDateString(),
        ], Expense::STATUS_PENDING);

        $this->createExpense([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'amount' => 20,
            'expense_date' => now()->toDateString(),
        ], Expense::STATUS_APPROVED);

        $response = $this->getJson('/api/v1/expenses?status=' . Expense::STATUS_APPROVED);

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', Expense::STATUS_APPROVED);
    }

    public function test_can_create_expense(): void
    {
        $category = ExpenseCategory::factory()->create(['tenant_id' => $this->tenant->id]);

        $data = [
            'expense_category_id' => $category->id,
            'description' => 'Nova despesa',
            'amount' => 150.50,
            'expense_date' => now()->format('Y-m-d'),
            'payment_method' => 'cartao_credito',
            'notes' => 'Teste de criacao',
        ];

        $response = $this->postJson('/api/v1/expenses', $data);

        $response->assertCreated()
            ->assertJsonPath('description', 'Nova despesa');

        $this->assertDatabaseHas('expenses', [
            'tenant_id' => $this->tenant->id,
            'description' => 'Nova despesa',
            'amount' => 150.50,
        ]);
    }

    public function test_can_update_expense(): void
    {
        $expense = $this->createExpense([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Original',
            'amount' => 100,
            'expense_date' => now()->format('Y-m-d'),
        ]);

        $response = $this->putJson("/api/v1/expenses/{$expense->id}", [
            'description' => 'Editado',
            'amount' => 200,
        ]);

        $response->assertOk()
            ->assertJsonPath('description', 'Editado');

        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'description' => 'Editado',
            'amount' => 200,
        ]);
    }

    public function test_can_delete_expense(): void
    {
        $expense = $this->createExpense([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'amount' => 100,
            'expense_date' => now()->format('Y-m-d'),
        ]);

        $this->deleteJson("/api/v1/expenses/{$expense->id}")->assertNoContent();

        $this->assertSoftDeleted('expenses', ['id' => $expense->id]);
    }

    public function test_can_export_expenses(): void
    {
        Expense::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/expenses/export');

        $response->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }
}
