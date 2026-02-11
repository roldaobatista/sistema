<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashFlowTest extends TestCase
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
        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_cash_flow_is_tenant_scoped_and_includes_expenses(): void
    {
        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Receita local',
            'amount' => 100,
            'amount_paid' => 100,
            'due_date' => now()->toDateString(),
            'status' => 'paid',
        ]);

        AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Custo local',
            'amount' => 20,
            'amount_paid' => 20,
            'due_date' => now()->toDateString(),
            'status' => 'paid',
        ]);

        Expense::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Despesa local',
            'amount' => 10,
            'expense_date' => now()->toDateString(),
            'status' => 'approved',
        ]);

        $otherTenant = Tenant::factory()->create();
        $otherCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);
        $otherUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
            'is_active' => true,
        ]);

        AccountReceivable::withoutGlobalScopes()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $otherCustomer->id,
            'created_by' => $otherUser->id,
            'description' => 'Receita externa',
            'amount' => 999,
            'amount_paid' => 999,
            'due_date' => now()->toDateString(),
            'status' => 'paid',
        ]);

        $response = $this->getJson('/api/v1/cash-flow?months=1');

        $response->assertOk()
            ->assertJsonCount(1);

        $this->assertSame(100.0, (float) $response->json('0.receivables_total'));
        $this->assertSame(20.0, (float) $response->json('0.payables_total'));
        $this->assertSame(10.0, (float) $response->json('0.expenses_total'));
        $this->assertSame(70.0, (float) $response->json('0.balance'));
    }

    public function test_cash_flow_accepts_os_number_filter(): void
    {
        $woA = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-CF-01',
            'number' => 'OS-4001',
        ]);
        $woB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-CF-99',
            'number' => 'OS-4099',
        ]);

        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'work_order_id' => $woA->id,
            'created_by' => $this->user->id,
            'description' => 'Receita OS A',
            'amount' => 500,
            'amount_paid' => 500,
            'due_date' => now()->toDateString(),
            'status' => 'paid',
        ]);
        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'work_order_id' => $woB->id,
            'created_by' => $this->user->id,
            'description' => 'Receita OS B',
            'amount' => 900,
            'amount_paid' => 900,
            'due_date' => now()->toDateString(),
            'status' => 'paid',
        ]);

        AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Compra para BLOCO-CF-01',
            'amount' => 100,
            'amount_paid' => 100,
            'due_date' => now()->toDateString(),
            'status' => 'paid',
        ]);
        AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Compra para BLOCO-CF-99',
            'amount' => 200,
            'amount_paid' => 200,
            'due_date' => now()->toDateString(),
            'status' => 'paid',
        ]);

        Expense::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $woA->id,
            'created_by' => $this->user->id,
            'description' => 'Despesa OS A',
            'amount' => 50,
            'expense_date' => now()->toDateString(),
            'status' => 'approved',
        ]);
        Expense::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $woB->id,
            'created_by' => $this->user->id,
            'description' => 'Despesa OS B',
            'amount' => 70,
            'expense_date' => now()->toDateString(),
            'status' => 'approved',
        ]);

        $response = $this->getJson('/api/v1/cash-flow?months=1&os_number=BLOCO-CF-01');
        $response->assertOk()->assertJsonCount(1);

        $this->assertSame(500.0, (float) $response->json('0.receivables_total'));
        $this->assertSame(100.0, (float) $response->json('0.payables_total'));
        $this->assertSame(50.0, (float) $response->json('0.expenses_total'));
        $this->assertSame(350.0, (float) $response->json('0.balance'));
    }

    public function test_dre_accepts_os_number_filter(): void
    {
        $woA = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-DRE-01',
            'number' => 'OS-5001',
        ]);
        $woB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-DRE-02',
            'number' => 'OS-5002',
        ]);

        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'work_order_id' => $woA->id,
            'created_by' => $this->user->id,
            'description' => 'Receita A',
            'amount' => 700,
            'amount_paid' => 700,
            'due_date' => now()->toDateString(),
            'paid_at' => now()->toDateString(),
            'status' => 'paid',
        ]);
        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'work_order_id' => $woB->id,
            'created_by' => $this->user->id,
            'description' => 'Receita B',
            'amount' => 900,
            'amount_paid' => 900,
            'due_date' => now()->toDateString(),
            'paid_at' => now()->toDateString(),
            'status' => 'paid',
        ]);

        AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Custo BLOCO-DRE-01',
            'amount' => 100,
            'amount_paid' => 100,
            'due_date' => now()->toDateString(),
            'paid_at' => now()->toDateString(),
            'status' => 'paid',
        ]);
        AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Custo BLOCO-DRE-02',
            'amount' => 150,
            'amount_paid' => 150,
            'due_date' => now()->toDateString(),
            'paid_at' => now()->toDateString(),
            'status' => 'paid',
        ]);

        Expense::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $woA->id,
            'created_by' => $this->user->id,
            'description' => 'Despesa A',
            'amount' => 80,
            'expense_date' => now()->toDateString(),
            'status' => 'approved',
        ]);
        Expense::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $woB->id,
            'created_by' => $this->user->id,
            'description' => 'Despesa B',
            'amount' => 40,
            'expense_date' => now()->toDateString(),
            'status' => 'approved',
        ]);

        $response = $this->getJson('/api/v1/dre?date_from=2000-01-01&date_to=2100-01-01&os_number=BLOCO-DRE-01');

        $response->assertOk()
            ->assertJsonPath('period.os_number', 'BLOCO-DRE-01');

        $this->assertSame(700.0, (float) ($response->json('revenue') ?? 0));
        $this->assertSame(100.0, (float) ($response->json('costs') ?? 0));
        $this->assertSame(80.0, (float) ($response->json('expenses') ?? 0));
        $this->assertSame(180.0, (float) ($response->json('total_costs') ?? 0));
        $this->assertSame(520.0, (float) ($response->json('gross_profit') ?? 0));
    }
}
