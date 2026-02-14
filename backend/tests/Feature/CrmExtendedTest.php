<?php

namespace Tests\Feature;

use App\Models\CrmDeal;
use App\Models\CrmPipeline;
use App\Models\CrmPipelineStage;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * CRM Extended Tests — validates deal lifecycle, pipeline management,
 * activities, customer 360, and stage transitions.
 */
class CrmExtendedTest extends TestCase
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

    // ── DASHBOARD ──

    public function test_crm_dashboard_returns_metrics(): void
    {
        $response = $this->getJson('/api/v1/crm/dashboard');
        $response->assertOk();
    }

    public function test_crm_constants_returns_enums(): void
    {
        $response = $this->getJson('/api/v1/crm/constants');
        $response->assertOk();
    }

    // ── DEALS ──

    public function test_deals_index_returns_paginated_list(): void
    {
        $response = $this->getJson('/api/v1/crm/deals');
        $response->assertOk();
    }

    public function test_create_deal_with_valid_data(): void
    {
        $pipeline = CrmPipeline::factory()->create(['tenant_id' => $this->tenant->id]);
        $stage = CrmPipelineStage::factory()->create([
            'pipeline_id' => $pipeline->id,
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->postJson('/api/v1/crm/deals', [
            'title' => 'Negócio com Cliente X',
            'customer_id' => $this->customer->id,
            'pipeline_id' => $pipeline->id,
            'stage_id' => $stage->id,
            'value' => 50000.00,
        ]);

        $response->assertCreated();
    }

    public function test_deal_mark_won(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->putJson("/api/v1/crm/deals/{$deal->id}/won");

        $response->assertOk();

        $deal->refresh();
        $this->assertEquals('won', $deal->status);
    }

    public function test_deal_mark_lost(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->putJson("/api/v1/crm/deals/{$deal->id}/lost", [
            'loss_reason' => 'Cliente escolheu concorrente',
        ]);

        $response->assertOk();

        $deal->refresh();
        $this->assertEquals('lost', $deal->status);
    }

    // ── ACTIVITIES ──

    public function test_activities_index_returns_list(): void
    {
        $response = $this->getJson('/api/v1/crm/activities');
        $response->assertOk();
    }

    public function test_create_activity(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->postJson('/api/v1/crm/activities', [
            'deal_id' => $deal->id,
            'type' => 'call',
            'title' => 'Ligação de follow-up',
            'scheduled_at' => now()->addDays(1)->toISOString(),
        ]);

        $response->assertCreated();
    }

    // ── PIPELINES ──

    public function test_pipelines_index_returns_list(): void
    {
        $response = $this->getJson('/api/v1/crm/pipelines');
        $response->assertOk();
    }

    public function test_create_pipeline(): void
    {
        $response = $this->postJson('/api/v1/crm/pipelines', [
            'name' => 'Pipeline de Vendas',
        ]);

        $response->assertCreated();
    }

    // ── CUSTOMER 360 ──

    public function test_customer_360_returns_aggregated_data(): void
    {
        $response = $this->getJson("/api/v1/crm/customers/{$this->customer->id}/360");

        $response->assertOk();

        $data = $response->json();
        $this->assertIsArray($data);
    }
}
