<?php

namespace Tests\Unit;

use App\Services\CommissionService;
use App\Models\CommissionRule;
use App\Models\CommissionEvent;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Tests\TestCase;

/**
 * Unit tests for CommissionService — validates commission calculations,
 * beneficiary identification, campaign multipliers, and edge cases.
 */
class CommissionServiceTest extends TestCase
{
    use RefreshDatabase;

    private CommissionService $service;
    private Tenant $tenant;
    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new CommissionService();
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        $this->actingAs($this->user);
    }

    private function createWorkOrder(float $total = 1000.00): WorkOrder
    {
        return WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'total' => $total,
            'status' => WorkOrder::STATUS_COMPLETED,
        ]);
    }

    // ── CAMPAIGN MULTIPLIER LOGIC ──

    public function test_campaign_multiplier_with_no_campaigns_returns_base_amount(): void
    {
        $campaigns = collect([]);
        $result = $this->invokePrivateMethod(
            $this->service,
            'applyCampaignMultiplier',
            [$campaigns, 'technician', 'percentage', '100.00']
        );

        $this->assertEquals('100.00', $result['final_amount']);
        $this->assertEquals('1', $result['multiplier']);
        $this->assertNull($result['campaign_name']);
    }

    public function test_campaign_multiplier_picks_highest_multiplier(): void
    {
        $campaigns = collect([
            (object) ['name' => 'Campaign A', 'multiplier' => 1.5, 'applies_to_role' => null, 'applies_to_calculation_type' => null],
            (object) ['name' => 'Campaign B', 'multiplier' => 2.0, 'applies_to_role' => null, 'applies_to_calculation_type' => null],
            (object) ['name' => 'Campaign C', 'multiplier' => 1.2, 'applies_to_role' => null, 'applies_to_calculation_type' => null],
        ]);

        $result = $this->invokePrivateMethod(
            $this->service,
            'applyCampaignMultiplier',
            [$campaigns, 'technician', 'percentage', '100.00']
        );

        $this->assertEquals('200.00', $result['final_amount']);
        $this->assertEquals('2', $result['multiplier']);
        $this->assertEquals('Campaign B', $result['campaign_name']);
    }

    public function test_campaign_multiplier_filters_by_role(): void
    {
        $campaigns = collect([
            (object) ['name' => 'Tech Only', 'multiplier' => 2.0, 'applies_to_role' => 'technician', 'applies_to_calculation_type' => null],
            (object) ['name' => 'Sales Only', 'multiplier' => 3.0, 'applies_to_role' => 'salesperson', 'applies_to_calculation_type' => null],
        ]);

        $result = $this->invokePrivateMethod(
            $this->service,
            'applyCampaignMultiplier',
            [$campaigns, 'technician', 'percentage', '100.00']
        );

        $this->assertEquals('200.00', $result['final_amount']);
        $this->assertEquals('Tech Only', $result['campaign_name']);
    }

    public function test_zero_value_work_order_produces_zero_commission(): void
    {
        $wo = $this->createWorkOrder(0.00);

        CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Rule Zero',
            'type' => CommissionRule::TYPE_PERCENTAGE,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'value' => 10,
            'applies_to' => CommissionRule::APPLIES_ALL,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
            'active' => true,
        ]);

        $events = $this->service->calculateAndGenerate($wo);
        $totalCommission = collect($events)->sum('amount');

        $this->assertEquals(0, $totalCommission);
    }

    // ── SIMULATION ──

    public function test_simulate_does_not_persist_events(): void
    {
        $wo = $this->createWorkOrder(1000.00);

        CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Rule Sim',
            'type' => CommissionRule::TYPE_PERCENTAGE,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'value' => 10,
            'applies_to' => CommissionRule::APPLIES_ALL,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
            'active' => true,
        ]);

        $beforeCount = CommissionEvent::count();
        $this->service->simulate($wo);
        $afterCount = CommissionEvent::count();

        $this->assertEquals($beforeCount, $afterCount);
    }

    /**
     * Helper to call private methods for testing.
     */
    private function invokePrivateMethod(object $object, string $methodName, array $parameters = []): mixed
    {
        $reflection = new \ReflectionClass(get_class($object));
        $method = $reflection->getMethod($methodName);
        $method->setAccessible(true);
        return $method->invokeArgs($object, $parameters);
    }
}
