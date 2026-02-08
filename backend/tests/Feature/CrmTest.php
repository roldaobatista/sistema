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

class CrmTest extends TestCase
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

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        // Bind tenant scope
        app()->instance('current_tenant_id', $this->tenant->id);

        $this->pipeline = CrmPipeline::factory()->default()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $this->stage = CrmPipelineStage::factory()->create([
            'pipeline_id' => $this->pipeline->id,
            'name' => 'Prospecção',
            'sort_order' => 0,
            'probability' => 20,
        ]);

        $this->wonStage = CrmPipelineStage::factory()->won()->create([
            'pipeline_id' => $this->pipeline->id,
            'sort_order' => 9,
        ]);

        $this->lostStage = CrmPipelineStage::factory()->lost()->create([
            'pipeline_id' => $this->pipeline->id,
            'sort_order' => 10,
        ]);

        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        Sanctum::actingAs($this->user, ['*']);
    }

    // ─── Dashboard ──────────────────────────────────────

    public function test_dashboard_returns_kpis_and_pipeline_data(): void
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

        $response = $this->getJson('/api/v1/crm/dashboard');

        $response->assertOk()
            ->assertJsonStructure([
                'kpis' => [
                    'open_deals', 'won_month', 'lost_month',
                    'revenue_in_pipeline', 'won_revenue',
                    'avg_health_score', 'no_contact_90d', 'conversion_rate',
                ],
                'pipelines',
                'recent_deals',
                'upcoming_activities',
                'top_customers',
                'calibration_alerts',
            ])
            ->assertJsonPath('kpis.open_deals', 3)
            ->assertJsonPath('kpis.won_month', 1);
    }

    // ─── Pipelines ──────────────────────────────────────

    public function test_list_pipelines(): void
    {
        $response = $this->getJson('/api/v1/crm/pipelines');

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', $this->pipeline->name);
    }

    public function test_create_pipeline_with_stages(): void
    {
        $response = $this->postJson('/api/v1/crm/pipelines', [
            'name' => 'Manutenção',
            'slug' => 'manutencao',
            'color' => '#FF6600',
            'stages' => [
                ['name' => 'Triagem', 'probability' => 10],
                ['name' => 'Em Andamento', 'probability' => 50],
                ['name' => 'Concluído', 'probability' => 100, 'is_won' => true],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'Manutenção')
            ->assertJsonCount(3, 'stages');

        $this->assertDatabaseHas('crm_pipelines', [
            'tenant_id' => $this->tenant->id,
            'slug' => 'manutencao',
        ]);
    }

    // ─── Deals CRUD ─────────────────────────────────────

    public function test_create_deal(): void
    {
        $response = $this->postJson('/api/v1/crm/deals', [
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
            'title' => 'Calibração Balança #001',
            'value' => 1500.00,
            'probability' => 30,
            'source' => 'calibracao_vencendo',
        ]);

        $response->assertCreated()
            ->assertJsonPath('title', 'Calibração Balança #001')
            ->assertJsonPath('status', 'open');

        $this->assertDatabaseHas('crm_deals', [
            'tenant_id' => $this->tenant->id,
            'title' => 'Calibração Balança #001',
        ]);
    }

    public function test_list_deals_with_filters(): void
    {
        CrmDeal::factory()->count(2)->create([
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
        ]);

        // All deals
        $this->getJson('/api/v1/crm/deals')
            ->assertOk()
            ->assertJsonPath('total', 3);

        // Filter open only
        $this->getJson('/api/v1/crm/deals?status=open')
            ->assertOk()
            ->assertJsonPath('total', 2);
    }

    public function test_show_deal_with_relationships(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
        ]);

        $response = $this->getJson("/api/v1/crm/deals/{$deal->id}");

        $response->assertOk()
            ->assertJsonPath('id', $deal->id)
            ->assertJsonStructure([
                'id', 'title', 'value', 'status',
                'customer', 'stage', 'pipeline',
            ]);
    }

    public function test_update_deal(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
            'value' => 1000,
        ]);

        $response = $this->putJson("/api/v1/crm/deals/{$deal->id}", [
            'value' => 2500,
            'title' => 'Deal Atualizado',
        ]);

        $response->assertOk()
            ->assertJsonPath('value', '2500.00')
            ->assertJsonPath('title', 'Deal Atualizado');
    }

    public function test_delete_deal(): void
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

    // ─── Deal Stage Movement ────────────────────────────

    public function test_move_deal_to_stage(): void
    {
        $stage2 = CrmPipelineStage::factory()->create([
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
            'stage_id' => $stage2->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('stage.name', 'Qualificação');

        // Probability should update
        $this->assertDatabaseHas('crm_deals', [
            'id' => $deal->id,
            'stage_id' => $stage2->id,
            'probability' => 50,
        ]);

        // System activity should be logged
        $this->assertDatabaseHas('crm_activities', [
            'deal_id' => $deal->id,
            'type' => 'system',
            'is_automated' => true,
        ]);
    }

    // ─── Deal Won / Lost ────────────────────────────────

    public function test_mark_deal_as_won(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
        ]);

        $response = $this->putJson("/api/v1/crm/deals/{$deal->id}/won");

        $response->assertOk()
            ->assertJsonPath('status', 'won');

        $this->assertDatabaseHas('crm_deals', [
            'id' => $deal->id,
            'status' => 'won',
            'probability' => 100,
        ]);
    }

    public function test_mark_deal_as_lost_with_reason(): void
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
        ]);
    }

    // ─── Activities ─────────────────────────────────────

    public function test_create_activity(): void
    {
        $response = $this->postJson('/api/v1/crm/activities', [
            'type' => 'ligacao',
            'customer_id' => $this->customer->id,
            'title' => 'Ligação de follow-up',
            'channel' => 'telefone',
            'outcome' => 'conectou',
            'duration_minutes' => 15,
        ]);

        $response->assertCreated()
            ->assertJsonPath('type', 'ligacao')
            ->assertJsonPath('title', 'Ligação de follow-up');

        // Customer last_contact_at should be updated
        $this->customer->refresh();
        $this->assertNotNull($this->customer->last_contact_at);
    }

    public function test_list_activities_with_filters(): void
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

        // All
        $this->getJson('/api/v1/crm/activities')
            ->assertOk()
            ->assertJsonPath('total', 5);

        // Filter by type
        $this->getJson('/api/v1/crm/activities?type=ligacao')
            ->assertOk()
            ->assertJsonPath('total', 3);
    }

    // ─── Constants ──────────────────────────────────────

    public function test_constants_endpoint(): void
    {
        $response = $this->getJson('/api/v1/crm/constants');

        $response->assertOk()
            ->assertJsonStructure([
                'deal_statuses',
                'deal_sources',
                'activity_types',
                'activity_outcomes',
                'activity_channels',
            ]);
    }

    // ─── Model Methods ──────────────────────────────────

    public function test_deal_mark_won_moves_to_won_stage(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
            'probability' => 30,
        ]);

        $deal->markAsWon();
        $deal->refresh();

        $this->assertEquals('won', $deal->status);
        $this->assertEquals(100, $deal->probability);
        $this->assertEquals($this->wonStage->id, $deal->stage_id);
        $this->assertNotNull($deal->won_at);
    }

    public function test_deal_mark_lost_moves_to_lost_stage(): void
    {
        $deal = CrmDeal::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pipeline_id' => $this->pipeline->id,
            'stage_id' => $this->stage->id,
        ]);

        $deal->markAsLost('Concorrente ganhou');
        $deal->refresh();

        $this->assertEquals('lost', $deal->status);
        $this->assertEquals(0, $deal->probability);
        $this->assertEquals($this->lostStage->id, $deal->stage_id);
        $this->assertEquals('Concorrente ganhou', $deal->lost_reason);
    }

    public function test_activity_log_system_event(): void
    {
        $activity = CrmActivity::logSystemEvent(
            $this->tenant->id,
            $this->customer->id,
            'Test system event',
            null,
            $this->user->id
        );

        $this->assertDatabaseHas('crm_activities', [
            'id' => $activity->id,
            'type' => 'system',
            'is_automated' => true,
            'title' => 'Test system event',
        ]);
    }

    // ─── Automations Command ────────────────────────────

    public function test_automation_command_runs_successfully(): void
    {
        $this->artisan('crm:process-automations', ['--tenant' => $this->tenant->id])
            ->assertSuccessful();
    }

    public function test_automation_is_idempotent(): void
    {
        // Ensure customer has recent contact so 90d rule doesn't trigger
        $this->customer->update(['last_contact_at' => now()]);

        // Run twice — should not duplicate
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
}
