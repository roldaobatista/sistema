<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Query Efficiency Tests — detects N+1 queries by counting
 * SQL queries executed per endpoint. If a list endpoint executes
 * more queries than expected, there's likely a missing eager load.
 */
class QueryEfficiencyTest extends TestCase
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
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    /**
     * Helper to count queries executed during a callback.
     */
    private function countQueries(callable $callback): int
    {
        DB::enableQueryLog();
        DB::flushQueryLog();
        $callback();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    // ── CUSTOMER LIST — N+1 DETECTION ──

    public function test_customer_list_no_n_plus_one(): void
    {
        Customer::factory()->count(30)->create(['tenant_id' => $this->tenant->id]);

        $queryCount = $this->countQueries(function () {
            $this->getJson('/api/v1/customers')->assertOk();
        });

        // Should be constant-ish queries (< 15), NOT 30+ (N+1)
        $this->assertLessThan(15, $queryCount, "Customer list executed {$queryCount} queries (limit: 15). Possible N+1.");
    }

    // ── WORK ORDER LIST — N+1 DETECTION ──

    public function test_work_order_list_no_n_plus_one(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        WorkOrder::factory()->count(30)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
        ]);

        $queryCount = $this->countQueries(function () {
            $this->getJson('/api/v1/work-orders')->assertOk();
        });

        // WO loads customer, items, equipment — should be < 20 queries
        $this->assertLessThan(20, $queryCount, "Work order list executed {$queryCount} queries (limit: 20). Possible N+1.");
    }

    // ── PRODUCT LIST — N+1 DETECTION ──

    public function test_product_list_no_n_plus_one(): void
    {
        Product::factory()->count(30)->create(['tenant_id' => $this->tenant->id]);

        $queryCount = $this->countQueries(function () {
            $this->getJson('/api/v1/products')->assertOk();
        });

        $this->assertLessThan(15, $queryCount, "Product list executed {$queryCount} queries (limit: 15). Possible N+1.");
    }

    // ── EQUIPMENT LIST — N+1 DETECTION ──

    public function test_equipment_list_no_n_plus_one(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        Equipment::factory()->count(30)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
        ]);

        $queryCount = $this->countQueries(function () {
            $this->getJson('/api/v1/equipments')->assertOk();
        });

        $this->assertLessThan(15, $queryCount, "Equipment list executed {$queryCount} queries (limit: 15). Possible N+1.");
    }

    // ── DASHBOARD — QUERY COUNT ──

    public function test_dashboard_query_count_reasonable(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        WorkOrder::factory()->count(20)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
        ]);

        $queryCount = $this->countQueries(function () {
            $this->getJson('/api/v1/dashboard')->assertOk();
        });

        // Dashboard runs multiple aggregations — should be < 25 queries
        $this->assertLessThan(25, $queryCount, "Dashboard executed {$queryCount} queries (limit: 25). Possible optimization needed.");
    }

    // ── SINGLE RECORD — QUERY COUNT ──

    public function test_customer_show_query_count(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $queryCount = $this->countQueries(function () use ($customer) {
            $this->getJson("/api/v1/customers/{$customer->id}")->assertOk();
        });

        // Single record should be < 8 queries
        $this->assertLessThan(8, $queryCount, "Customer show executed {$queryCount} queries (limit: 8).");
    }

    public function test_work_order_show_query_count(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
        ]);

        $queryCount = $this->countQueries(function () use ($wo) {
            $this->getJson("/api/v1/work-orders/{$wo->id}")->assertOk();
        });

        // WO show loads relations — should be < 12 queries
        $this->assertLessThan(12, $queryCount, "Work order show executed {$queryCount} queries (limit: 12).");
    }
}
