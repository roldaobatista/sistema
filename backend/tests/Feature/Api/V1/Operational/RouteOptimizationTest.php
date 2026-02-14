<?php

namespace Tests\Feature\Api\V1\Operational;

use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RouteOptimizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_optimize_route()
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        
        \Spatie\Permission\Models\Permission::create(['name' => 'os.work_order.view', 'guard_name' => 'web']);
        $user->givePermissionTo('os.work_order.view');
        
        // Create 3 customers at distinct locations
        // Start point: (0, 0)
        // C1: (1, 1) - dist ~1.41
        // C2: (0, 0.1) - dist ~0.1 (Nearest)
        // C3: (10, 10) - dist ~14.1 (Farthest)
        
        $c1 = Customer::factory()->create(['tenant_id' => $tenant->id, 'latitude' => 1.0, 'longitude' => 1.0]);
        $c2 = Customer::factory()->create(['tenant_id' => $tenant->id, 'latitude' => 0.0, 'longitude' => 0.1]);
        $c3 = Customer::factory()->create(['tenant_id' => $tenant->id, 'latitude' => 10.0, 'longitude' => 10.0]);

        $wo1 = WorkOrder::factory()->create(['tenant_id' => $tenant->id, 'customer_id' => $c1->id]);
        $wo2 = WorkOrder::factory()->create(['tenant_id' => $tenant->id, 'customer_id' => $c2->id]);
        $wo3 = WorkOrder::factory()->create(['tenant_id' => $tenant->id, 'customer_id' => $c3->id]);

        $response = $this->actingAs($user)->postJson('/api/v1/operational/route-optimization', [
            'work_order_ids' => [$wo1->id, $wo2->id, $wo3->id],
            'start_lat' => 0.0,
            'start_lng' => 0.0,
        ]);

        $response->assertOk();
        
        // Expected order: C2 (nearest), then C1 (next nearest from C2), then C3
        $optimized = $response->json();
        
        $this->assertEquals($wo2->id, $optimized[0]['id']);
        $this->assertEquals($wo1->id, $optimized[1]['id']);
        $this->assertEquals($wo3->id, $optimized[2]['id']);
    }
}
