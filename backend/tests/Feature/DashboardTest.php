<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\CrmDeal;
use App\Models\Equipment;
use App\Models\Expense;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Dashboard API Tests — validates the /dashboard-stats endpoint
 * returns all required KPIs with correct types and values.
 */
class DashboardTest extends TestCase
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

    public function test_dashboard_returns_required_kpi_keys(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats');
        $response->assertOk();

        $requiredKeys = [
            'open_os', 'in_progress_os', 'completed_month',
            'revenue_month', 'pending_commissions', 'expenses_month',
            'recent_os', 'top_technicians',
        ];

        foreach ($requiredKeys as $key) {
            $this->assertArrayHasKey($key, $response->json(), "Missing key: {$key}");
        }
    }

    public function test_dashboard_returns_numeric_values(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats');
        $data = $response->json();

        $this->assertIsInt($data['open_os']);
        $this->assertIsInt($data['in_progress_os']);
        $this->assertIsInt($data['completed_month']);
        $this->assertIsNumeric($data['revenue_month']);
    }

    public function test_dashboard_with_work_orders_counts_correctly(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);
        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'status' => WorkOrder::STATUS_IN_PROGRESS,
        ]);

        $response = $this->getJson('/api/v1/dashboard-stats');
        $data = $response->json();

        $this->assertGreaterThanOrEqual(1, $data['open_os']);
        $this->assertGreaterThanOrEqual(1, $data['in_progress_os']);
    }

    public function test_dashboard_returns_financial_kpis(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats');
        $data = $response->json();

        $this->assertArrayHasKey('receivables_pending', $data);
        $this->assertArrayHasKey('receivables_overdue', $data);
        $this->assertArrayHasKey('payables_pending', $data);
        $this->assertArrayHasKey('payables_overdue', $data);
        $this->assertArrayHasKey('net_revenue', $data);
    }

    public function test_dashboard_returns_equipment_alerts(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats');
        $data = $response->json();

        $this->assertArrayHasKey('eq_overdue', $data);
        $this->assertArrayHasKey('eq_due_7', $data);
        $this->assertArrayHasKey('eq_alerts', $data);
        $this->assertIsArray($data['eq_alerts']);
    }

    public function test_dashboard_returns_crm_kpis(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats');
        $data = $response->json();

        $this->assertArrayHasKey('crm_open_deals', $data);
        $this->assertArrayHasKey('crm_won_month', $data);
        $this->assertArrayHasKey('crm_revenue_month', $data);
    }

    public function test_dashboard_returns_sla_stats(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats');
        $data = $response->json();

        $this->assertArrayHasKey('sla_total', $data);
        $this->assertArrayHasKey('sla_response_breached', $data);
        $this->assertArrayHasKey('sla_resolution_breached', $data);
    }

    public function test_dashboard_returns_monthly_revenue_chart(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats');
        $data = $response->json();

        $this->assertArrayHasKey('monthly_revenue', $data);
        $this->assertIsArray($data['monthly_revenue']);
        $this->assertCount(6, $data['monthly_revenue']); // 6 months

        foreach ($data['monthly_revenue'] as $point) {
            $this->assertArrayHasKey('month', $point);
            $this->assertArrayHasKey('total', $point);
        }
    }

    public function test_dashboard_accepts_date_filter(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats?date_from=2025-01-01&date_to=2025-12-31');
        $response->assertOk();
    }

    public function test_dashboard_recent_os_is_limited(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats');
        $data = $response->json();

        $this->assertLessThanOrEqual(10, count($data['recent_os']));
    }

    public function test_dashboard_top_technicians_is_limited(): void
    {
        $response = $this->getJson('/api/v1/dashboard-stats');
        $data = $response->json();

        $this->assertLessThanOrEqual(5, count($data['top_technicians']));
    }
}
