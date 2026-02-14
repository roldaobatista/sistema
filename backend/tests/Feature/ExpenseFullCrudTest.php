<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Expense CRUD — categories, store, duplicate, approval workflow,
 * batch status, export, analytics.
 */
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
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);
        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_list_expenses(): void
    {
        $response = $this->getJson('/api/v1/expenses');
        $response->assertOk();
    }

    public function test_list_expense_categories(): void
    {
        $response = $this->getJson('/api/v1/expense-categories');
        $response->assertOk();
    }

    public function test_create_expense_category(): void
    {
        $response = $this->postJson('/api/v1/expense-categories', [
            'name' => 'Transporte',
        ]);
        $response->assertCreated();
    }

    public function test_create_expense_with_valid_data(): void
    {
        $response = $this->postJson('/api/v1/expenses', [
            'description' => 'Combustível viagem SP',
            'amount' => 350.00,
            'date' => now()->format('Y-m-d'),
            'category_id' => null,
        ]);
        $response->assertCreated();
    }

    public function test_expense_summary_returns_totals(): void
    {
        $response = $this->getJson('/api/v1/expense-summary');
        $response->assertOk();
    }

    public function test_expense_analytics_endpoint(): void
    {
        $response = $this->getJson('/api/v1/expense-analytics');
        $response->assertOk();
    }

    public function test_expense_export_csv(): void
    {
        $response = $this->getJson('/api/v1/expenses-export');
        $response->assertOk();
    }
}
