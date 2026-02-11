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

        $event->refresh();
        $this->assertSame(CommissionEvent::STATUS_PAID, $event->status);

        $settlementId = $close->json('id');
        $pay = $this->postJson("/api/v1/commission-settlements/{$settlementId}/pay");

        $pay->assertOk()
            ->assertJsonPath('status', CommissionSettlement::STATUS_PAID);

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
            ->assertJsonCount(1)
            ->assertJsonPath('0.os_number', 'BLOCO-DSP-01');
    }
}
