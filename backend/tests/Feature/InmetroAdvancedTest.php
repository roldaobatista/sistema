<?php

namespace Tests\Feature;

use App\Models\InmetroOwner;
use App\Models\InmetroLocation;
use App\Models\InmetroInstrument;
use App\Models\InmetroLeadInteraction;
use App\Models\InmetroLeadScore;
use App\Models\InmetroProspectionQueue;
use App\Models\InmetroCompetitorSnapshot;
use App\Models\InmetroComplianceChecklist;
use App\Models\InmetroWebhook;
use App\Models\InmetroWinLoss;
use App\Models\InmetroCompetitor;
use App\Models\User;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InmetroAdvancedTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        
        $this->user->tenants()->attach($this->tenant);
        $this->user->switchTenant($this->tenant);

        $this->user->givePermissionTo([
            'inmetro.intelligence.view',
            'inmetro.intelligence.import',
            'inmetro.intelligence.enrich',
            'inmetro.intelligence.convert',
        ]);

        $this->actingAs($this->user);
    }

    private function createOwnerWithInstruments(int $count = 2, array $ownerAttrs = [], array $instrumentAttrs = []): InmetroOwner
    {
        $owner = InmetroOwner::factory()->create(array_merge([
            'tenant_id' => $this->tenant->id,
            'lead_status' => 'new',
        ], $ownerAttrs));

        $location = InmetroLocation::factory()->create([
            'owner_id' => $owner->id,
            'address_city' => 'Cuiabá',
            'address_state' => 'MT',
        ]);

        for ($i = 0; $i < $count; $i++) {
            InmetroInstrument::factory()->create(array_merge([
                'location_id' => $location->id,
                'current_status' => 'approved',
                'next_verification_at' => now()->addDays(30),
            ], $instrumentAttrs));
        }

        return $owner->fresh();
    }

    // ════════════════════════════════════════════
    // PROSPECTION TESTS
    // ════════════════════════════════════════════

    public function test_generate_daily_queue()
    {
        $this->createOwnerWithInstruments(3, ['lead_status' => 'new', 'priority' => 'urgent']);
        $this->createOwnerWithInstruments(2, ['lead_status' => 'new', 'priority' => 'high']);

        $response = $this->postJson('/api/v1/inmetro/advanced/generate-queue');

        $response->assertOk()
            ->assertJsonStructure(['total_generated', 'queue']);
    }

    public function test_get_contact_queue()
    {
        $owner = $this->createOwnerWithInstruments(1);
        InmetroProspectionQueue::factory()->create([
            'tenant_id' => $this->tenant->id,
            'owner_id' => $owner->id,
            'queue_date' => now()->toDateString(),
            'status' => 'pending',
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/contact-queue');

        $response->assertOk()
            ->assertJsonStructure(['date', 'total', 'items']);
    }

    public function test_mark_queue_item()
    {
        $owner = $this->createOwnerWithInstruments(1);
        $queue = InmetroProspectionQueue::factory()->create([
            'tenant_id' => $this->tenant->id,
            'owner_id' => $owner->id,
            'status' => 'pending',
        ]);

        $response = $this->patchJson("/api/v1/inmetro/advanced/queue/{$queue->id}", [
            'status' => 'contacted',
        ]);

        $response->assertOk()
            ->assertJson(['message' => 'Queue item updated']);

        $this->assertDatabaseHas('inmetro_prospection_queue', [
            'id' => $queue->id,
            'status' => 'contacted',
        ]);
    }

    public function test_calculate_lead_score()
    {
        $owner = $this->createOwnerWithInstruments(5, [
            'lead_status' => 'new',
            'estimated_revenue' => 50000,
        ], [
            'next_verification_at' => now()->addDays(15), // expiring soon
        ]);

        $response = $this->getJson("/api/v1/inmetro/advanced/lead-score/{$owner->id}");

        $response->assertOk()
            ->assertJsonStructure(['message', 'data' => ['score', 'factors']]);

        $this->assertGreaterThan(0, $response->json('data.total_score'));
    }

    public function test_recalculate_all_scores()
    {
        $this->createOwnerWithInstruments(2);
        $this->createOwnerWithInstruments(3);

        $response = $this->postJson('/api/v1/inmetro/advanced/recalculate-scores');

        $response->assertOk()
            ->assertJsonFragment(['message' => 'Scores recalculated for 2 owners']);
    }

    public function test_detect_churn()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/churn');

        $response->assertOk()
            ->assertJsonStructure(['total_at_risk', 'customers']);
    }

    public function test_new_registrations()
    {
        $this->createOwnerWithInstruments(1, [], [
            'created_at' => now()->subDay(),
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/new-registrations');

        $response->assertOk()
            ->assertJsonStructure(['since', 'total_new', 'registrations']);
    }

    public function test_suggest_next_calibrations()
    {
        $this->createOwnerWithInstruments(2, [], [
            'next_verification_at' => now()->addDays(30),
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/next-calibrations');

        $response->assertOk()
            ->assertJsonStructure(['period_days', 'total', 'suggestions']);
    }

    public function test_classify_segments()
    {
        $this->createOwnerWithInstruments(1);

        $response = $this->postJson('/api/v1/inmetro/advanced/classify-segments');

        $response->assertOk();
    }

    public function test_segment_distribution()
    {
        $this->createOwnerWithInstruments(1, ['segment' => 'agronegocio']);
        $this->createOwnerWithInstruments(1, ['segment' => 'industria']);

        $response = $this->getJson('/api/v1/inmetro/advanced/segment-distribution');

        $response->assertOk()
            ->assertJsonStructure(['segments', 'total']);
    }

    public function test_reject_alerts()
    {
        $this->createOwnerWithInstruments(1, [], [
            'current_status' => 'rejected',
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/reject-alerts');

        $response->assertOk()
            ->assertJsonStructure(['total_rejected', 'alerts']);
    }

    public function test_conversion_ranking()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/conversion-ranking');

        $response->assertOk()
            ->assertJsonStructure(['period', 'ranking']);
    }

    public function test_log_interaction()
    {
        $owner = $this->createOwnerWithInstruments(1);

        $response = $this->postJson('/api/v1/inmetro/advanced/interactions', [
            'owner_id' => $owner->id,
            'channel' => 'whatsapp',
            'result' => 'interested',
            'notes' => 'Cliente demonstrou interesse na calibração',
        ]);

        $response->assertCreated()
            ->assertJson(['message' => 'Interaction logged']);

        $this->assertDatabaseHas('inmetro_lead_interactions', [
            'owner_id' => $owner->id,
            'channel' => 'whatsapp',
            'result' => 'interested',
        ]);
    }

    public function test_interaction_history()
    {
        $owner = $this->createOwnerWithInstruments(1);
        InmetroLeadInteraction::factory()->count(3)->create([
            'owner_id' => $owner->id,
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson("/api/v1/inmetro/advanced/interactions/{$owner->id}");

        $response->assertOk()
            ->assertJsonStructure(['total', 'interactions']);
    }

    // ════════════════════════════════════════════
    // TERRITORIAL TESTS
    // ════════════════════════════════════════════

    public function test_layered_map_data()
    {
        $this->createOwnerWithInstruments(1);

        $response = $this->getJson('/api/v1/inmetro/advanced/map-layers');

        $response->assertOk()
            ->assertJsonStructure(['layers']);
    }

    public function test_optimize_route()
    {
        $owner1 = $this->createOwnerWithInstruments(1);
        $owner2 = $this->createOwnerWithInstruments(1);

        $response = $this->postJson('/api/v1/inmetro/advanced/optimize-route', [
            'base_lat' => -15.6,
            'base_lng' => -56.1,
            'owner_ids' => [$owner1->id, $owner2->id],
        ]);

        $response->assertOk()
            ->assertJsonStructure(['stops', 'total_distance_km']);
    }

    public function test_competitor_zones()
    {
        InmetroCompetitor::factory()->create([
            'tenant_id' => $this->tenant->id,
            'city' => 'Cuiabá',
            'state' => 'MT',
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/competitor-zones');

        $response->assertOk()
            ->assertJsonStructure(['zones']);
    }

    public function test_coverage_vs_potential()
    {
        $this->createOwnerWithInstruments(1);

        $response = $this->getJson('/api/v1/inmetro/advanced/coverage-potential');

        $response->assertOk()
            ->assertJsonStructure(['regions']);
    }

    public function test_density_viability()
    {
        $response = $this->postJson('/api/v1/inmetro/advanced/density-viability', [
            'base_lat' => -15.6,
            'base_lng' => -56.1,
        ]);

        $response->assertOk()
            ->assertJsonStructure(['base', 'regions']);
    }

    public function test_nearby_leads()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/nearby-leads?lat=-15.6&lng=-56.1&radius_km=100');

        $response->assertOk()
            ->assertJsonStructure(['center', 'radius_km', 'total', 'leads']);
    }

    // ════════════════════════════════════════════
    // COMPETITOR TRACKING TESTS
    // ════════════════════════════════════════════

    public function test_snapshot_market_share()
    {
        InmetroCompetitor::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);
        $this->createOwnerWithInstruments(1);

        $response = $this->postJson('/api/v1/inmetro/advanced/snapshot-market-share');

        $response->assertOk()
            ->assertJsonStructure(['message', 'data']);
    }

    public function test_market_share_timeline()
    {
        InmetroCompetitorSnapshot::factory()->create([
            'tenant_id' => $this->tenant->id,
            'period_start' => now()->startOfMonth(),
            'period_end' => now()->endOfMonth(),
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/market-share-timeline');

        $response->assertOk()
            ->assertJsonStructure(['months', 'timeline']);
    }

    public function test_competitor_movements()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/competitor-movements');

        $response->assertOk()
            ->assertJsonStructure(['movements']);
    }

    public function test_pricing_estimate()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/pricing-estimate');

        $response->assertOk();
    }

    public function test_competitor_profile()
    {
        $competitor = InmetroCompetitor::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson("/api/v1/inmetro/advanced/competitor-profile/{$competitor->id}");

        $response->assertOk()
            ->assertJsonStructure(['competitor', 'instruments_serviced', 'market_share']);
    }

    public function test_record_win_loss()
    {
        $owner = $this->createOwnerWithInstruments(1);
        
        $response = $this->postJson('/api/v1/inmetro/advanced/win-loss', [
            'outcome' => 'win',
            'reason' => 'price',
            'estimated_value' => '5000',
            'notes' => 'Won deal against competitor',
            'owner_id' => $owner->id,
        ]);
        


        $response->assertCreated()
            ->assertJson(['message' => 'Win/Loss recorded']);

        $this->assertDatabaseHas('inmetro_win_loss', [
            'outcome' => 'win',
            'reason' => 'price',
        ]);
    }

    public function test_win_loss_analysis()
    {
        InmetroWinLoss::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/win-loss');

        $response->assertOk()
            ->assertJsonStructure(['summary', 'by_reason', 'by_competitor']);
    }

    // ════════════════════════════════════════════
    // OPERATIONAL BRIDGE TESTS
    // ════════════════════════════════════════════

    public function test_suggest_linked_equipments()
    {
        $owner = $this->createOwnerWithInstruments(2, [
            'converted_to_customer_id' => 1,
        ]);

        $response = $this->getJson("/api/v1/inmetro/advanced/suggest-equipments/{$owner->converted_to_customer_id}");

        $response->assertOk();
    }

    public function test_prefill_certificate()
    {
        $owner = $this->createOwnerWithInstruments(1);
        $instrument = InmetroInstrument::whereHas('location', fn($q) => $q->where('owner_id', $owner->id))->first();

        $response = $this->getJson("/api/v1/inmetro/advanced/prefill-certificate/{$instrument->id}");

        $response->assertOk()
            ->assertJsonStructure(['instrument', 'owner', 'prefill']);
    }

    public function test_instrument_timeline()
    {
        $owner = $this->createOwnerWithInstruments(1);
        $instrument = InmetroInstrument::whereHas('location', fn($q) => $q->where('owner_id', $owner->id))->first();

        $response = $this->getJson("/api/v1/inmetro/advanced/instrument-timeline/{$instrument->id}");

        $response->assertOk()
            ->assertJsonStructure(['instrument', 'events']);
    }

    public function test_compare_calibrations()
    {
        $owner = $this->createOwnerWithInstruments(1);
        $instrument = InmetroInstrument::whereHas('location', fn($q) => $q->where('owner_id', $owner->id))->first();

        $response = $this->getJson("/api/v1/inmetro/advanced/compare-calibrations/{$instrument->id}");

        $response->assertOk()
            ->assertJsonStructure(['instrument', 'comparisons']);
    }

    // ════════════════════════════════════════════
    // REPORTING TESTS
    // ════════════════════════════════════════════

    public function test_executive_dashboard()
    {
        $this->createOwnerWithInstruments(3);

        $response = $this->getJson('/api/v1/inmetro/advanced/executive-dashboard');

        $response->assertOk()
            ->assertJsonStructure(['kpis', 'roi']);
    }

    public function test_revenue_forecast()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/revenue-forecast');

        $response->assertOk()
            ->assertJsonStructure(['months', 'forecast']);
    }

    public function test_conversion_funnel()
    {
        $this->createOwnerWithInstruments(1, ['lead_status' => 'new']);
        $this->createOwnerWithInstruments(1, ['lead_status' => 'contacted']);
        $this->createOwnerWithInstruments(1, ['lead_status' => 'converted']);

        $response = $this->getJson('/api/v1/inmetro/advanced/conversion-funnel');

        $response->assertOk()
            ->assertJsonStructure(['stages', 'conversion_rates']);
    }

    public function test_export_data()
    {
        $this->createOwnerWithInstruments(2);

        $response = $this->getJson('/api/v1/inmetro/advanced/export-data');

        $response->assertOk();
    }

    public function test_year_over_year()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/year-over-year');

        $response->assertOk()
            ->assertJsonStructure(['current_year', 'previous_year', 'deltas']);
    }

    // ════════════════════════════════════════════
    // COMPLIANCE TESTS
    // ════════════════════════════════════════════

    public function test_compliance_checklists()
    {
        InmetroComplianceChecklist::factory()->create([
            'tenant_id' => $this->tenant->id,
            'instrument_type' => 'balanca_rodoviaria',
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/compliance-checklists');

        $response->assertOk();
    }

    public function test_create_compliance_checklist()
    {
        $response = $this->postJson('/api/v1/inmetro/advanced/compliance-checklists', [
            'instrument_type' => 'balanca_comercial',
            'title' => 'Checklist de calibração comercial',
            'items' => ['Verificar selo', 'Verificar certificado', 'Teste de carga'],
            'regulation_reference' => 'Portaria 236/2022',
        ]);

        $response->assertCreated()
            ->assertJson(['message' => 'Checklist created']);

        $this->assertDatabaseHas('inmetro_compliance_checklists', [
            'instrument_type' => 'balanca_comercial',
            'title' => 'Checklist de calibração comercial',
        ]);
    }

    public function test_update_compliance_checklist()
    {
        $checklist = InmetroComplianceChecklist::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->putJson("/api/v1/inmetro/advanced/compliance-checklists/{$checklist->id}", [
            'title' => 'Updated checklist',
        ]);

        $response->assertOk()
            ->assertJson(['message' => 'Checklist updated']);
    }

    public function test_regulatory_traceability()
    {
        $owner = $this->createOwnerWithInstruments(1);
        $instrument = InmetroInstrument::whereHas('location', fn($q) => $q->where('owner_id', $owner->id))->first();

        $response = $this->getJson("/api/v1/inmetro/advanced/regulatory-traceability/{$instrument->id}");

        $response->assertOk()
            ->assertJsonStructure(['instrument', 'traceability_chain']);
    }

    public function test_simulate_regulatory_impact()
    {
        $this->createOwnerWithInstruments(5);

        $response = $this->postJson('/api/v1/inmetro/advanced/simulate-impact', [
            'current_period_months' => 12,
            'new_period_months' => 6,
        ]);

        $response->assertOk()
            ->assertJsonStructure(['scenario', 'impact', 'recommendation']);
    }

    public function test_corporate_groups()
    {
        InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'cnpj_root' => '12345678',
            'estimated_revenue' => 10000,
        ]);
        InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'cnpj_root' => '12345678',
            'estimated_revenue' => 20000,
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/corporate-groups');

        $response->assertOk()
            ->assertJsonStructure(['total_groups', 'groups']);
        $this->assertEquals(1, $response->json('total_groups'));
    }

    public function test_detect_anomalies()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/anomalies');

        $response->assertOk()
            ->assertJsonStructure(['total_anomalies', 'by_severity', 'anomalies']);
    }

    public function test_renewal_probability()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/renewal-probability');

        $response->assertOk()
            ->assertJsonStructure(['total_customers', 'high_risk', 'medium_risk', 'low_risk', 'predictions']);
    }

    // ════════════════════════════════════════════
    // WEBHOOK TESTS
    // ════════════════════════════════════════════

    public function test_list_webhooks()
    {
        InmetroWebhook::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson('/api/v1/inmetro/advanced/webhooks');

        $response->assertOk();
    }

    public function test_create_webhook()
    {
        $response = $this->postJson('/api/v1/inmetro/advanced/webhooks', [
            'event_type' => 'new_lead',
            'url' => 'https://example.com/webhook',
            'secret' => 'my-webhook-secret',
        ]);

        $response->assertCreated()
            ->assertJson(['message' => 'Webhook created']);

        $this->assertDatabaseHas('inmetro_webhooks', [
            'event_type' => 'new_lead',
            'url' => 'https://example.com/webhook',
        ]);
    }

    public function test_update_webhook()
    {
        $webhook = InmetroWebhook::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->putJson("/api/v1/inmetro/advanced/webhooks/{$webhook->id}", [
            'is_active' => false,
        ]);

        if ($response->status() !== 200) {
            dump($response->json());
        }

        $response->assertOk()
            ->assertJson(['message' => 'Webhook updated']);
    }

    public function test_delete_webhook()
    {
        $webhook = InmetroWebhook::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->deleteJson("/api/v1/inmetro/advanced/webhooks/{$webhook->id}");

        $response->assertOk()
            ->assertJson(['message' => 'Webhook deleted']);

        $this->assertDatabaseMissing('inmetro_webhooks', ['id' => $webhook->id]);
    }

    public function test_available_webhook_events()
    {
        $response = $this->getJson('/api/v1/inmetro/advanced/webhook-events');

        $response->assertOk()
            ->assertJsonStructure(['new_lead', 'lead_expiring', 'instrument_rejected']);
    }

    public function test_public_instrument_data()
    {
        $this->createOwnerWithInstruments(3);

        $response = $this->getJson('/api/v1/inmetro/advanced/public-data');

        $response->assertOk();
    }

    // ════════════════════════════════════════════
    // PERMISSION TESTS
    // ════════════════════════════════════════════

    public function test_unauthorized_user_cannot_access_advanced_endpoints()
    {
        $user = User::factory()->create();
        $user->tenants()->attach($this->tenant);
        $user->switchTenant($this->tenant);
        $this->actingAs($user);

        $this->getJson('/api/v1/inmetro/advanced/contact-queue')->assertForbidden();
        $this->postJson('/api/v1/inmetro/advanced/generate-queue')->assertForbidden();
        $this->getJson('/api/v1/inmetro/advanced/executive-dashboard')->assertForbidden();
    }

    // ════════════════════════════════════════════
    // VALIDATION TESTS
    // ════════════════════════════════════════════

    public function test_log_interaction_validates_required_fields()
    {
        $response = $this->postJson('/api/v1/inmetro/advanced/interactions', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['owner_id', 'channel', 'result']);
    }

    public function test_create_webhook_validates_required_fields()
    {
        $response = $this->postJson('/api/v1/inmetro/advanced/webhooks', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['event_type', 'url']);
    }

    public function test_optimize_route_validates_coordinates()
    {
        $response = $this->postJson('/api/v1/inmetro/advanced/optimize-route', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['base_lat', 'base_lng', 'owner_ids']);
    }

    public function test_simulate_impact_validates_periods()
    {
        $response = $this->postJson('/api/v1/inmetro/advanced/simulate-impact', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['current_period_months', 'new_period_months']);
    }
}
