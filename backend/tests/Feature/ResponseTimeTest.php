<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Response Time Tests — validates that critical endpoints respond
 * within acceptable time limits under realistic data volumes.
 *
 * Limits are generous (< 500ms) to avoid flaky tests in CI,
 * while still catching N+1 queries and missing indexes.
 */
class ResponseTimeTest extends TestCase
{
    use LazilyRefreshDatabase;

    private Tenant $tenant;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Model::unsetEventDispatcher();

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

    // ── CUSTOMER LIST ──

    public function test_customer_list_under_500ms_with_20_records(): void
    {
        Customer::factory()->count(20)->create(['tenant_id' => $this->tenant->id]);

        $start = microtime(true);
        $response = $this->getJson('/api/v1/customers');
        $elapsed = (microtime(true) - $start) * 1000;

        $response->assertOk();
        $this->assertLessThan(500, $elapsed, "Customer list took {$elapsed}ms (limit: 500ms)");
    }

    // ── WORK ORDER LIST ──

    public function test_work_order_list_under_500ms_with_20_records(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        WorkOrder::factory()->count(20)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
        ]);

        $start = microtime(true);
        $response = $this->getJson('/api/v1/work-orders');
        $elapsed = (microtime(true) - $start) * 1000;

        $response->assertOk();
        $this->assertLessThan(500, $elapsed, "Work order list took {$elapsed}ms (limit: 500ms)");
    }

    // ── PRODUCT LIST ──

    public function test_product_list_under_500ms_with_50_records(): void
    {
        Product::factory()->count(50)->create(['tenant_id' => $this->tenant->id]);

        $start = microtime(true);
        $response = $this->getJson('/api/v1/products');
        $elapsed = (microtime(true) - $start) * 1000;

        $response->assertOk();
        $this->assertLessThan(500, $elapsed, "Product list took {$elapsed}ms (limit: 500ms)");
    }

    // ── EQUIPMENT LIST ──

    public function test_equipment_list_under_500ms_with_20_records(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        Equipment::factory()->count(20)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
        ]);

        $start = microtime(true);
        $response = $this->getJson('/api/v1/equipments');
        $elapsed = (microtime(true) - $start) * 1000;

        $response->assertOk();
        $this->assertLessThan(500, $elapsed, "Equipment list took {$elapsed}ms (limit: 500ms)");
    }

    // ── DASHBOARD ──

    public function test_dashboard_stats_under_500ms(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        WorkOrder::factory()->count(20)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
        ]);

        $start = microtime(true);
        $response = $this->getJson('/api/v1/dashboard-stats');
        $elapsed = (microtime(true) - $start) * 1000;

        $response->assertOk();
        $this->assertLessThan(500, $elapsed, "Dashboard took {$elapsed}ms (limit: 500ms)");
    }

    // ── FINANCIAL REPORTS ──
    public function test_cash_flow_under_500ms(): void
    {
        $start = microtime(true);
        $response = $this->getJson('/api/v1/cash-flow?date_from=2025-01-01&date_to=2025-12-31');
        $elapsed = (microtime(true) - $start) * 1000;

        $response->assertOk();
        $this->assertLessThan(500, $elapsed, "Cash flow took {$elapsed}ms (limit: 500ms)");
    }

    public function test_dre_under_500ms(): void
    {
        $start = microtime(true);
        $response = $this->getJson('/api/v1/dre');
        $elapsed = (microtime(true) - $start) * 1000;

        $response->assertOk();
        $this->assertLessThan(500, $elapsed, "DRE took {$elapsed}ms (limit: 500ms)");
    }

    // ── SEARCH/FILTER ──

    public function test_customer_search_under_300ms(): void
    {
        Customer::factory()->count(20)->create(['tenant_id' => $this->tenant->id]);

        $start = microtime(true);
        $response = $this->getJson('/api/v1/customers?search=test');
        $elapsed = (microtime(true) - $start) * 1000;

        $response->assertOk();
        $this->assertLessThan(300, $elapsed, "Customer search took {$elapsed}ms (limit: 300ms)");
    }
}
