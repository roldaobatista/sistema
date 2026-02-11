<?php

namespace Tests\Unit;

use App\Models\CommissionEvent;
use App\Models\CommissionRule;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\CommissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommissionServiceTest extends TestCase
{
    use RefreshDatabase;

    private CommissionService $service;
    private Tenant $tenant;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(CommissionService::class);
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
    }

    public function test_calculate_and_generate_simple_percentage()
    {
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'total' => 1000,
            'assigned_to' => $this->user->id,
        ]);

        CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => '10% on Gross',
            'type' => 'percentage',
            'value' => 10,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'active' => true,
        ]);

        $events = $this->service->calculateAndGenerate($workOrder);

        $this->assertCount(1, $events);
        $this->assertEquals(100.00, $events[0]->commission_amount);
        $this->assertEquals($this->user->id, $events[0]->user_id);
    }

    public function test_calculate_with_campaign_multiplier()
    {
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'total' => 1000,
            'assigned_to' => $this->user->id,
        ]);

        CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => '10% Standard',
            'value' => 10,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'active' => true,
        ]);

        // Crie campanha manualmente usando DB facade se model não existir factory
        \Illuminate\Support\Facades\DB::table('commission_campaigns')->insert([
            'tenant_id' => $this->tenant->id,
            'name' => 'Double Commission Week',
            'multiplier' => 2.0,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'active' => true,
        ]);

        $events = $this->service->calculateAndGenerate($workOrder);

        $this->assertCount(1, $events);
        $this->assertEquals(200.00, $events[0]->commission_amount); // 100 * 2
        $this->assertStringContainsString('Double Commission Week', $events[0]->notes);
    }
    
    public function test_prevents_duplicate_generation()
    {
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'total' => 1000,
        ]);

        CommissionEvent::factory()->create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrder->id,
        ]);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Comissões já geradas');

        $this->service->calculateAndGenerate($workOrder);
    }
}
