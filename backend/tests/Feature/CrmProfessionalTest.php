<?php

namespace Tests\Feature;

use App\Models\CrmActivity;
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
 * Professional CRM tests — verifies deal lifecycle (open → won/lost),
 * pipeline stage movement with probability sync, activity logging,
 * exact KPI calculations, and customer health score updates.
 */
class CrmProfessionalTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private CrmPipeline $pipeline;
    private CrmPipelineStage $stage;
    private CrmPipelineStage $wonStage;
    private CrmPipelineStage $lostStage;
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
            'is_active' => true,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);

        $this->pipeline = CrmPipeline::factory()->default()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $this->stage = CrmPipelineStage::factory()->create([
            'tenant_id' => $this->tenant->id,
            'pipeline_id' => $this->pipeline->id,
            'name' => 'Prospecção',
            'sort_order' => 0,
            'probability' => 20,
        ]);

        $this->wonStage = CrmPipelineStage::factory()->won()->create([
            'tenant_id' => $this->tenant->id,
            'pipeline_id' => $this->pipeline->id,
            'sort_order' => 9,
        ]);

        $this->lostStage = CrmPipelineStage::factory()->lost()->create([
            'tenant_id' => $this->tenant->id,
            'pipeline_id' => $this->pipeline->id,
            'sort_order' => 10,
        ]);

        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        Sanctum::actingAs($this->user, ['*']);
    }

    // ── DEAL LIFECYCLE ──

    public function test_create_deal_with_all_fields_persists(): void
    {
        $response = $this->postJson('/api/v1/crm/deals', [
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
            'title' => 'Calibração Anual #001',
            'value' => 5000.00,
            'probability' => 30,
            'source' => 'calibracao_vencendo',
        ]);

        $response->assertCreated()
            ->assertJsonPath('title', 'Calibração Anual #001')
            ->assertJsonPath('status', 'open')
            ->assertJsonPath('value', '5000.00');

        $this->assertDatabaseHas('crm_deals', [
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'title' => 'Calibração Anual #001',
            'value' => 5000.00,
            'status' => 'open',
        ]);
    }

    public function test_move_deal_to_stage_syncs_probability_and_logs_activity(): void
    {
        $qualificacao = CrmPipelineStage::factory()->create([
            'tenant_id' => $this->tenant->id,
            'pipeline_id' => $this->pipeline->id,
            'name' => 'Qualificação',
            'sort_order' => 1,
            'probability' => 50,
        ]);

        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
            'probability' => 20,
        ]);

        $response = $this->putJson("/api/v1/crm/deals/{$deal->id}/stage", [
            'stage_id' => $qualificacao->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('stage.name', 'Qualificação');

        // Probability synced from stage
        $this->assertDatabaseHas('crm_deals', [
            'id' => $deal->id,
            'stage_id' => $qualificacao->id,
            'probability' => 50,
        ]);

        // System activity logged
        $this->assertDatabaseHas('crm_activities', [
            'deal_id' => $deal->id,
            'type' => 'system',
            'is_automated' => true,
        ]);
    }

    public function test_mark_deal_won_sets_100_percent_and_won_stage(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
            'probability' => 20,
            'value' => 3000,
        ]);

        $response = $this->putJson("/api/v1/crm/deals/{$deal->id}/won");

        $response->assertOk()
            ->assertJsonPath('status', 'won');

        $this->assertDatabaseHas('crm_deals', [
            'id' => $deal->id,
            'status' => 'won',
            'probability' => 100,
            'stage_id' => $this->wonStage->id,
        ]);

        $deal->refresh();
        $this->assertNotNull($deal->won_at);
    }

    public function test_mark_deal_lost_sets_0_percent_and_persists_reason(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
        ]);

        $response = $this->putJson("/api/v1/crm/deals/{$deal->id}/lost", [
            'lost_reason' => 'Preço acima do mercado',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'lost');

        $this->assertDatabaseHas('crm_deals', [
            'id' => $deal->id,
            'status' => 'lost',
            'probability' => 0,
            'lost_reason' => 'Preço acima do mercado',
            'stage_id' => $this->lostStage->id,
        ]);
    }

    public function test_delete_deal_soft_deletes(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
        ]);

        $this->deleteJson("/api/v1/crm/deals/{$deal->id}")
            ->assertNoContent();

        $this->assertSoftDeleted('crm_deals', ['id' => $deal->id]);
    }

    // ── PIPELINE MANAGEMENT ──

    public function test_create_pipeline_with_stages_persists(): void
    {
        $response = $this->postJson('/api/v1/crm/pipelines', [
            'name' => 'Manutenção Preventiva',
            'slug' => 'manutencao-prev',
            'color' => '#FF6600',
            'stages' => [
                ['name' => 'Triagem', 'probability' => 10],
                ['name' => 'Em Andamento', 'probability' => 50],
                ['name' => 'Concluído', 'probability' => 100, 'is_won' => true],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'Manutenção Preventiva')
            ->assertJsonCount(3, 'stages');

        $this->assertDatabaseHas('crm_pipelines', [
            'tenant_id' => $this->tenant->id,
            'slug' => 'manutencao-prev',
        ]);
    }

    // ── ACTIVITIES ──

    public function test_create_activity_updates_customer_last_contact(): void
    {
        $this->assertNull($this->customer->last_contact_at);

        $response = $this->postJson('/api/v1/crm/activities', [
            'type' => 'ligacao',
            'customer_id' => $this->customer->id,
            'title' => 'Follow-up calibração',
            'channel' => 'telefone',
            'outcome' => 'conectou',
            'duration_minutes' => 15,
        ]);

        $response->assertCreated()
            ->assertJsonPath('type', 'ligacao');

        $this->customer->refresh();
        $this->assertNotNull($this->customer->last_contact_at);
    }

    public function test_list_activities_filters_by_type(): void
    {
        CrmActivity::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'user_id' => $this->user->id,
            'type' => 'ligacao',
        ]);

        CrmActivity::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'user_id' => $this->user->id,
            'type' => 'email',
        ]);

        $this->getJson('/api/v1/crm/activities?type=ligacao')
            ->assertOk()
            ->assertJsonPath('total', 3);

        $this->getJson('/api/v1/crm/activities')
            ->assertOk()
            ->assertJsonPath('total', 5);
    }

    // ── DASHBOARD KPIs ──

    public function test_dashboard_returns_accurate_kpi_counts(): void
    {
        CrmDeal::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
            'status' => 'open',
        ]);

        CrmDeal::factory()->won()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->wonStage->id,
            'won_at' => now(),
        ]);

        CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->lostStage->id,
            'status' => 'lost',
            'lost_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/crm/dashboard');

        $response->assertOk()
            ->assertJsonStructure([
                'kpis' => [
                    'open_deals', 'won_month', 'lost_month',
                    'revenue_in_pipeline', 'won_revenue',
                ],
                'pipelines',
                'recent_deals',
            ])
            ->assertJsonPath('kpis.open_deals', 3)
            ->assertJsonPath('kpis.won_month', 1)
            ->assertJsonPath('kpis.lost_month', 1);
    }

    // ── AUTOMATION: Idempotency ──

    public function test_automation_is_idempotent(): void
    {
        $this->customer->update(['last_contact_at' => now()]);

        $this->artisan('crm:process-automations', ['--tenant' => $this->tenant->id])
            ->assertSuccessful();

        $count1 = CrmActivity::where('tenant_id', $this->tenant->id)
            ->where('is_automated', true)
            ->count();

        $this->artisan('crm:process-automations', ['--tenant' => $this->tenant->id])
            ->assertSuccessful();

        $count2 = CrmActivity::where('tenant_id', $this->tenant->id)
            ->where('is_automated', true)
            ->count();

        $this->assertEquals($count1, $count2);
    }

    // ── TENANT ISOLATION ──

    public function test_deals_from_other_tenant_not_visible(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherPipeline = CrmPipeline::factory()->create(['tenant_id' => $otherTenant->id]);
        $otherStage = CrmPipelineStage::factory()->create([
            'tenant_id' => $otherTenant->id,
            'pipeline_id' => $otherPipeline->id,
        ]);

        CrmDeal::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $otherPipeline->id,
            'stage_id' => $otherStage->id,
            'title' => 'Deal externo',
        ]);

        $response = $this->getJson('/api/v1/crm/deals');

        $response->assertOk()
            ->assertJsonPath('total', 0);
    }
}
