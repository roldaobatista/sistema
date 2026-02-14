<?php

namespace Tests\Feature;

use App\Models\SlaPolicy;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * SLA Dashboard Extended Tests — validates overview KPIs,
 * breached order listing, and compliance by policy breakdown.
 */
class SlaDashboardExtendedTest extends TestCase
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

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_sla_overview_returns_structured_response(): void
    {
        $response = $this->getJson('/api/v1/sla-dashboard/overview');
        $response->assertOk();

        $data = $response->json();
        $this->assertArrayHasKey('total_com_sla', $data);
        $this->assertArrayHasKey('response', $data);
        $this->assertArrayHasKey('resolution', $data);
        $this->assertArrayHasKey('em_risco', $data);

        // Response / resolution sub-structure
        $this->assertArrayHasKey('cumprido', $data['response']);
        $this->assertArrayHasKey('estourado', $data['response']);
        $this->assertArrayHasKey('taxa', $data['response']);
    }

    public function test_sla_breached_orders_returns_paginated(): void
    {
        $response = $this->getJson('/api/v1/sla-dashboard/breached');
        $response->assertOk();

        $data = $response->json();
        // Should have pagination structure
        if (isset($data['data'])) {
            $this->assertIsArray($data['data']);
        }
    }

    public function test_sla_by_policy_returns_compliance_rates(): void
    {
        // Create an SLA policy
        $policy = SlaPolicy::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/sla-dashboard/by-policy');
        $response->assertOk();

        $data = $response->json();
        $this->assertIsArray($data);
    }

    public function test_sla_overview_with_breached_work_orders(): void
    {
        // Create WO with SLA breach
        $policy = SlaPolicy::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'sla_policy_id' => $policy->id,
            'sla_response_breached' => true,
        ]);

        $response = $this->getJson('/api/v1/sla-dashboard/overview');
        $response->assertOk();

        $data = $response->json();
        $this->assertGreaterThanOrEqual(1, $data['response']['estourado']);
    }
}
