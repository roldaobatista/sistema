<?php

namespace Tests\Feature;

use App\Models\CommissionEvent;
use App\Models\CommissionRule;
use App\Models\CommissionSettlement;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommissionTest extends TestCase
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

    public function test_store_rule_rejects_user_from_other_tenant(): void
    {
        $foreignUser = User::factory()->create([
            'tenant_id' => Tenant::factory()->create()->id,
            'current_tenant_id' => null,
        ]);

        $response = $this->postJson('/api/v1/commission-rules', [
            'user_id' => $foreignUser->id,
            'name' => 'Regra Invalida',
            'value' => 10,
            'calculation_type' => 'percent_gross',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['user_id']);
    }

    public function test_close_settlement_rejects_user_from_other_tenant(): void
    {
        $foreignUser = User::factory()->create([
            'tenant_id' => Tenant::factory()->create()->id,
            'current_tenant_id' => null,
        ]);

        $response = $this->postJson('/api/v1/commission-settlements/close', [
            'user_id' => $foreignUser->id,
            'period' => now()->format('Y-m'),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['user_id']);
    }

    public function test_work_order_completed_generates_commission_events_from_active_rules(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'assigned_to' => $this->user->id,
            'status' => WorkOrder::STATUS_IN_PROGRESS,
            'total' => 1000,
            'os_number' => 'BLOCO-5501',
        ]);

        CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Comissao padrao',
            'type' => 'percentage',
            'value' => 10,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        $response = $this->postJson("/api/v1/work-orders/{$workOrder->id}/status", [
            'status' => WorkOrder::STATUS_COMPLETED,
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('commission_events', [
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrder->id,
            'user_id' => $this->user->id,
            'status' => CommissionEvent::STATUS_PENDING,
        ]);
    }

    public function test_commission_settlement_close_and_pay_have_consistent_status_flow(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'assigned_to' => $this->user->id,
            'total' => 1000,
        ]);

        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Regra fechamento mensal',
            'type' => 'percentage',
            'value' => 10,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        $event = CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrder->id,
            'user_id' => $this->user->id,
            'base_amount' => 1000,
            'commission_amount' => 100,
            'status' => CommissionEvent::STATUS_APPROVED,
        ]);

        $period = now()->format('Y-m');

        $close = $this->postJson('/api/v1/commission-settlements/close', [
            'user_id' => $this->user->id,
            'period' => $period,
        ]);

        $close->assertStatus(201)
            ->assertJsonPath('status', CommissionSettlement::STATUS_CLOSED);

        // After closing, events should remain APPROVED (not prematurely set to PAID)
        $event->refresh();
        $this->assertSame(CommissionEvent::STATUS_APPROVED, $event->status);

        $settlementId = $close->json('id');
        $pay = $this->postJson("/api/v1/commission-settlements/{$settlementId}/pay");

        $pay->assertOk()
            ->assertJsonPath('status', CommissionSettlement::STATUS_PAID);

        // Only after payment should events become PAID
        $event->refresh();
        $this->assertSame(CommissionEvent::STATUS_PAID, $event->status);
        $this->assertNotNull($pay->json('paid_at'));
    }

    public function test_commission_events_accept_os_number_filter(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $workOrderA = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-COM-001',
            'number' => 'OS-1001',
        ]);
        $workOrderB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-COM-999',
            'number' => 'OS-1002',
        ]);

        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Filtro OS',
            'type' => 'percentage',
            'value' => 10,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrderA->id,
            'user_id' => $this->user->id,
            'base_amount' => 1000,
            'commission_amount' => 100,
            'status' => CommissionEvent::STATUS_PENDING,
        ]);
        CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrderB->id,
            'user_id' => $this->user->id,
            'base_amount' => 1200,
            'commission_amount' => 120,
            'status' => CommissionEvent::STATUS_PENDING,
        ]);

        $this->getJson('/api/v1/commission-events?os_number=BLOCO-COM-001')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.work_order.os_number', 'BLOCO-COM-001');
    }

    public function test_commission_disputes_accept_os_number_filter_and_return_identifier(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $workOrderA = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-DSP-01',
            'number' => 'OS-8101',
        ]);
        $workOrderB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'os_number' => 'BLOCO-DSP-99',
            'number' => 'OS-8199',
        ]);

        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Regra disputa',
            'type' => 'percentage',
            'value' => 10,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        $eventA = CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrderA->id,
            'user_id' => $this->user->id,
            'base_amount' => 1000,
            'commission_amount' => 100,
            'status' => CommissionEvent::STATUS_PENDING,
        ]);
        $eventB = CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrderB->id,
            'user_id' => $this->user->id,
            'base_amount' => 1200,
            'commission_amount' => 120,
            'status' => CommissionEvent::STATUS_PENDING,
        ]);

        DB::table('commission_disputes')->insert([
            [
                'tenant_id' => $this->tenant->id,
                'commission_event_id' => $eventA->id,
                'user_id' => $this->user->id,
                'reason' => 'Divergencia no calculo da OS A',
                'status' => 'open', // Raw DB insert: model constant n/a for disputes
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'tenant_id' => $this->tenant->id,
                'commission_event_id' => $eventB->id,
                'user_id' => $this->user->id,
                'reason' => 'Divergencia no calculo da OS B',
                'status' => 'open', // Raw DB insert: model constant n/a for disputes
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->getJson('/api/v1/commission-disputes?os_number=BLOCO-DSP-01')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.commission_event.work_order.os_number', 'BLOCO-DSP-01');
    }
    public function test_reopen_settlement_reverts_approved_events_to_pending(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'assigned_to' => $this->user->id,
            'total' => 1000,
        ]);

        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Regra reopen test',
            'type' => 'percentage',
            'value' => 10,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        $event = CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrder->id,
            'user_id' => $this->user->id,
            'base_amount' => 1000,
            'commission_amount' => 100,
            'status' => CommissionEvent::STATUS_APPROVED,
        ]);

        $period = now()->format('Y-m');

        // Close the settlement first
        $close = $this->postJson('/api/v1/commission-settlements/close', [
            'user_id' => $this->user->id,
            'period' => $period,
        ]);

        $close->assertStatus(201);
        $settlementId = $close->json('id');

        // Reopen
        $reopen = $this->postJson("/api/v1/commission-settlements/{$settlementId}/reopen");
        $reopen->assertOk()
            ->assertJsonPath('status', CommissionSettlement::STATUS_OPEN);

        // Events should be reverted to pending
        $event->refresh();
        $this->assertSame(CommissionEvent::STATUS_PENDING, $event->status);
    }

    public function test_batch_update_status_validates_transitions(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'total' => 500,
        ]);

        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Batch test rule',
            'type' => 'percentage',
            'value' => 5,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        $pendingEvent = CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrder->id,
            'user_id' => $this->user->id,
            'base_amount' => 500,
            'commission_amount' => 25,
            'status' => CommissionEvent::STATUS_PENDING,
        ]);

        $paidEvent = CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrder->id,
            'user_id' => $this->user->id,
            'base_amount' => 500,
            'commission_amount' => 25,
            'status' => CommissionEvent::STATUS_PAID,
        ]);

        // Batch approve: pending->approved valid, paid->approved invalid
        $response = $this->postJson('/api/v1/commission-events/batch-status', [
            'ids' => [$pendingEvent->id, $paidEvent->id],
            'status' => CommissionEvent::STATUS_APPROVED,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.updated', 1)
            ->assertJsonPath('data.skipped', 1);

        $pendingEvent->refresh();
        $paidEvent->refresh();

        $this->assertSame(CommissionEvent::STATUS_APPROVED, $pendingEvent->status);
        $this->assertSame(CommissionEvent::STATUS_PAID, $paidEvent->status); // unchanged
    }

    public function test_update_event_status_rejects_invalid_transition(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'total' => 500,
        ]);

        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Transition test rule',
            'type' => 'percentage',
            'value' => 5,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        $pendingEvent = CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrder->id,
            'user_id' => $this->user->id,
            'base_amount' => 500,
            'commission_amount' => 25,
            'status' => CommissionEvent::STATUS_PENDING,
        ]);

        // pending → paid should fail (must go through approved first)
        $response = $this->putJson("/api/v1/commission-events/{$pendingEvent->id}/status", [
            'status' => CommissionEvent::STATUS_PAID,
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'Transição de status inválida: pending → paid']);

        // Verify event status unchanged
        $pendingEvent->refresh();
        $this->assertSame(CommissionEvent::STATUS_PENDING, $pendingEvent->status);

        // pending → approved should succeed
        $response = $this->putJson("/api/v1/commission-events/{$pendingEvent->id}/status", [
            'status' => CommissionEvent::STATUS_APPROVED,
        ]);

        $response->assertOk();
        $pendingEvent->refresh();
        $this->assertSame(CommissionEvent::STATUS_APPROVED, $pendingEvent->status);
    }

    public function test_simulate_applies_campaign_multiplier(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'assigned_to' => $this->user->id,
            'total' => 1000,
        ]);

        CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => '10% Sim Rule',
            'type' => 'percentage',
            'value' => 10,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        // Create active campaign with 1.5x multiplier
        DB::table('commission_campaigns')->insert([
            'tenant_id' => $this->tenant->id,
            'name' => 'Test Campaign 1.5x',
            'multiplier' => 1.5,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/commission-simulate', [
            'work_order_id' => $workOrder->id,
        ]);

        $response->assertOk();
        $simulations = $response->json();

        $this->assertNotEmpty($simulations);
        $sim = $simulations[0];

        // 10% of 1000 = 100, * 1.5 campaign = 150
        $this->assertEquals(150.00, $sim['commission_amount']);
        $this->assertEquals(1.5, $sim['multiplier']);
        $this->assertEquals('Test Campaign 1.5x', $sim['campaign_name']);
    }

    public function test_commission_percent_net_only_deducts_expenses_affecting_net_value(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'assigned_to' => $this->user->id,
            'status' => WorkOrder::STATUS_IN_PROGRESS,
            'total' => 1000,
        ]);

        // Expense that DOES affect net value (should be deducted)
        \App\Models\Expense::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrder->id,
            'created_by' => $this->user->id,
            'description' => 'Deductible expense',
            'amount' => 200,
            'expense_date' => now()->toDateString(),
            'status' => \App\Models\Expense::STATUS_APPROVED,
            'affects_net_value' => true,
        ]);

        // Expense that does NOT affect net value (should NOT be deducted)
        \App\Models\Expense::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrder->id,
            'created_by' => $this->user->id,
            'description' => 'Non-deductible expense',
            'amount' => 300,
            'expense_date' => now()->toDateString(),
            'status' => \App\Models\Expense::STATUS_APPROVED,
            'affects_net_value' => false,
        ]);

        // Rule: 10% of NET (gross - deductible expenses only)
        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Percent net test',
            'type' => 'percentage',
            'value' => 10,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_NET,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        // calculate() should use only the 200 expense (affects_net_value=true)
        // net = 1000 - 200 = 800, commission = 800 * 10% = 80
        $commission = $rule->calculate($workOrder);

        $this->assertEquals(80.0, $commission);
    }

    public function test_reject_settlement_sets_rejected_status_and_reverts_events(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'total' => 1000,
        ]);

        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Reject test rule',
            'type' => 'percentage',
            'value' => 10,
            'applies_to' => 'all',
            'active' => true,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
        ]);

        $event = CommissionEvent::create([
            'tenant_id' => $this->tenant->id,
            'commission_rule_id' => $rule->id,
            'work_order_id' => $workOrder->id,
            'user_id' => $this->user->id,
            'base_amount' => 1000,
            'commission_amount' => 100,
            'status' => CommissionEvent::STATUS_APPROVED,
        ]);

        $period = now()->format('Y-m');

        // Close the settlement
        $close = $this->postJson('/api/v1/commission-settlements/close', [
            'user_id' => $this->user->id,
            'period' => $period,
        ]);

        $close->assertStatus(201);
        $settlementId = $close->json('id');

        // Reject the settlement
        $reject = $this->postJson("/api/v1/commission-settlements/{$settlementId}/reject", [
            'rejection_reason' => 'Valores incorretos, necessário revisão.',
        ]);

        $reject->assertOk()
            ->assertJsonPath('status', CommissionSettlement::STATUS_REJECTED);

        // Events should be unlinked and reverted to pending
        $event->refresh();
        $this->assertSame(CommissionEvent::STATUS_PENDING, $event->status);
        $this->assertNull($event->settlement_id);
    }
}
