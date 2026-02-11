<?php

namespace Tests\Feature;

use App\Events\ContractRenewing;
use App\Listeners\CreateCentralItemOnContract;
use App\Models\CommissionRule;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\RecurringContract;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RecurringFlowTest extends TestCase
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

        $this->tenant = Tenant::factory()->create(['status' => 'active']);
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

    public function test_store_recurring_contract_rejects_foreign_tenant_relations(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);
        $foreignEquipment = Equipment::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $foreignCustomer->id,
        ]);
        $foreignUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);

        $response = $this->postJson('/api/v1/recurring-contracts', [
            'customer_id' => $foreignCustomer->id,
            'equipment_id' => $foreignEquipment->id,
            'assigned_to' => $foreignUser->id,
            'name' => 'Contrato invalido',
            'frequency' => 'monthly',
            'start_date' => now()->toDateString(),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['customer_id', 'equipment_id', 'assigned_to']);
    }

    public function test_process_monthly_generates_commission_for_active_recurring_contract(): void
    {
        $equipment = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $contract = RecurringContract::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'equipment_id' => $equipment->id,
            'assigned_to' => $this->user->id,
            'created_by' => $this->user->id,
            'name' => 'Contrato Mensal Ouro',
            'frequency' => 'monthly',
            'billing_type' => 'fixed_monthly',
            'monthly_value' => 1000,
            'start_date' => now()->subMonth()->toDateString(),
            'next_run_date' => now()->toDateString(),
            'is_active' => true,
            'priority' => 'normal',
        ]);

        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Comissao Recorrente 10%',
            'type' => 'percentage',
            'value' => 10,
            'applies_to' => 'all',
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
            'active' => true,
        ]);

        DB::table('recurring_commissions')->insert([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'recurring_contract_id' => $contract->id,
            'commission_rule_id' => $rule->id,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $workOrder = $contract->generateWorkOrder();

        $response = $this->postJson('/api/v1/recurring-commissions/process-monthly');

        $response->assertOk()
            ->assertJsonPath('data.generated', 1);

        $this->assertDatabaseHas('commission_events', [
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrder->id,
            'user_id' => $this->user->id,
            'status' => 'pending',
        ]);
    }

    public function test_contract_billing_command_generates_only_one_receivable_per_month(): void
    {
        $equipment = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $contract = RecurringContract::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'equipment_id' => $equipment->id,
            'assigned_to' => $this->user->id,
            'created_by' => $this->user->id,
            'name' => 'Plano Preventivo',
            'frequency' => 'monthly',
            'billing_type' => 'fixed_monthly',
            'monthly_value' => 450,
            'start_date' => now()->subMonths(2)->toDateString(),
            'next_run_date' => now()->toDateString(),
            'is_active' => true,
            'priority' => 'normal',
        ]);

        $this->artisan('contracts:bill-recurring')->assertSuccessful();
        $this->artisan('contracts:bill-recurring')->assertSuccessful();

        $count = \App\Models\AccountReceivable::where('tenant_id', $this->tenant->id)
            ->where('description', 'like', "Contrato Recorrente: {$contract->name}%")
            ->count();

        $this->assertSame(1, $count);
    }

    public function test_contract_billing_command_handles_same_name_contracts_without_skipping(): void
    {
        $equipmentA = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $equipmentB = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $contractA = RecurringContract::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'equipment_id' => $equipmentA->id,
            'assigned_to' => $this->user->id,
            'created_by' => $this->user->id,
            'name' => 'Plano Mensal',
            'frequency' => 'monthly',
            'billing_type' => 'fixed_monthly',
            'monthly_value' => 300,
            'start_date' => now()->subMonth()->toDateString(),
            'next_run_date' => now()->toDateString(),
            'is_active' => true,
            'priority' => 'normal',
        ]);

        $contractB = RecurringContract::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'equipment_id' => $equipmentB->id,
            'assigned_to' => $this->user->id,
            'created_by' => $this->user->id,
            'name' => 'Plano Mensal',
            'frequency' => 'monthly',
            'billing_type' => 'fixed_monthly',
            'monthly_value' => 450,
            'start_date' => now()->subMonth()->toDateString(),
            'next_run_date' => now()->toDateString(),
            'is_active' => true,
            'priority' => 'normal',
        ]);

        $this->artisan('contracts:bill-recurring')->assertSuccessful();

        $this->assertDatabaseHas('accounts_receivable', [
            'tenant_id' => $this->tenant->id,
            'notes' => "recurring_contract:{$contractA->id}:" . now()->format('Y-m'),
        ]);

        $this->assertDatabaseHas('accounts_receivable', [
            'tenant_id' => $this->tenant->id,
            'notes' => "recurring_contract:{$contractB->id}:" . now()->format('Y-m'),
        ]);
    }

    public function test_create_central_item_on_contract_uses_assigned_user(): void
    {
        $equipment = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $assignee = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);

        $contract = RecurringContract::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'equipment_id' => $equipment->id,
            'assigned_to' => $assignee->id,
            'created_by' => $this->user->id,
            'name' => 'Contrato VIP',
            'frequency' => 'monthly',
            'billing_type' => 'fixed_monthly',
            'monthly_value' => 700,
            'start_date' => now()->subMonth()->toDateString(),
            'end_date' => now()->addDays(10)->toDateString(),
            'next_run_date' => now()->toDateString(),
            'is_active' => true,
            'priority' => 'normal',
        ]);

        app(CreateCentralItemOnContract::class)->handle(new ContractRenewing($contract, 10));

        $this->assertDatabaseHas('central_items', [
            'tenant_id' => $this->tenant->id,
            'ref_id' => $contract->id,
            'responsavel_user_id' => $assignee->id,
        ]);
    }
}
