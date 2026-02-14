<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Commission Dashboard Tests — validates overview KPIs, ranking,
 * evolution time series, distribution by rule, and distribution by role.
 */
class CommissionDashboardTest extends TestCase
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

    public function test_commission_dashboard_overview(): void
    {
        $response = $this->getJson('/api/v1/commissions/dashboard/overview');
        $response->assertOk();

        $data = $response->json();
        $this->assertArrayHasKey('total_pending', $data);
        $this->assertArrayHasKey('total_approved', $data);
        $this->assertArrayHasKey('total_paid_month', $data);
    }

    public function test_commission_dashboard_ranking(): void
    {
        $response = $this->getJson('/api/v1/commissions/dashboard/ranking');
        $response->assertOk();

        $data = $response->json();
        $this->assertIsArray($data);
    }

    public function test_commission_dashboard_evolution(): void
    {
        $response = $this->getJson('/api/v1/commissions/dashboard/evolution?months=6');
        $response->assertOk();

        $data = $response->json();
        $this->assertIsArray($data);
    }

    public function test_commission_dashboard_by_rule(): void
    {
        $response = $this->getJson('/api/v1/commissions/dashboard/by-rule');
        $response->assertOk();
    }

    public function test_commission_dashboard_by_role(): void
    {
        $response = $this->getJson('/api/v1/commissions/dashboard/by-role');
        $response->assertOk();
    }
}
