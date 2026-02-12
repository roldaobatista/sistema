<?php

namespace Tests\Feature;

use App\Models\InmetroOwner;
use App\Models\InmetroLocation;
use App\Models\InmetroInstrument;
use App\Models\User;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class InmetroTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->tenant = Tenant::factory()->create();
        $this->user->tenants()->attach($this->tenant);
        $this->user->switchTenant($this->tenant);
        
        // Grant permissions
        $this->user->givePermissionTo([
            'inmetro.intelligence.view',
            'inmetro.intelligence.import',
            'inmetro.intelligence.enrich',
            'inmetro.intelligence.convert',
        ]);
        
        $this->actingAs($this->user);
    }

    public function test_can_list_owners()
    {
        InmetroOwner::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'lead_status' => 'new'
        ]);

        $response = $this->getJson('/api/v1/inmetro/owners');

        $response->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_can_view_dashboard_kpis()
    {
        InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'priority' => 'urgent'
        ]);

        $response = $this->getJson('/api/v1/inmetro/dashboard');

        $response->assertOk()
            ->assertJsonStructure([
                'totals', 'leads', 'by_city', 'by_status'
            ]);
    }

    public function test_xml_import_endpoint()
    {
        Http::fake([
            '*' => Http::response('<xml></xml>', 200),
        ]);

        $response = $this->postJson('/api/v1/inmetro/import/xml', [
            'uf' => 'MT',
            'type' => 'competitors'
        ]);

        $response->assertOk();
    }

    public function test_owner_enrichment_flow()
    {
        $owner = InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'document' => '12345678000195'
        ]);

        Http::fake([
            'brasilapi.com.br/*' => Http::response(['cnpj' => '12345678000195', 'razao_social' => 'Teste Ltda'], 200),
        ]);

        $response = $this->postJson("/api/v1/inmetro/enrich/{$owner->id}");

        $response->assertOk()
            ->assertJson(['success' => true]);
        
        $this->assertDatabaseHas('inmetro_owners', [
            'id' => $owner->id,
            'name' => 'Teste Ltda' // Assuming logic updates name fallback
        ]);
    }

    public function test_convert_to_customer()
    {
        $owner = InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'lead_status' => 'new'
        ]);

        $response = $this->postJson("/api/v1/inmetro/convert/{$owner->id}");

        $response->assertOk()
            ->assertJsonStructure(['customer_id']);

        $this->assertDatabaseHas('customers', [
            'document' => $owner->document
        ]);

        $this->assertDatabaseHas('inmetro_owners', [
            'id' => $owner->id,
            'lead_status' => 'converted'
        ]);
    }

    public function test_can_update_owner()
    {
        $owner = InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Original Name'
        ]);

        $response = $this->putJson("/api/v1/inmetro/owners/{$owner->id}", [
            'name' => 'Updated Name',
            'trade_name' => 'Updated Trade',
            'phone' => '(65) 9999-9999',
            'email' => 'updated@example.com',
            'notes' => 'Updated notes',
        ]);

        $response->assertOk()
            ->assertJsonFragment(['name' => 'Updated Name']);

        $this->assertDatabaseHas('inmetro_owners', [
            'id' => $owner->id,
            'name' => 'Updated Name',
            'trade_name' => 'Updated Trade',
        ]);
    }

    public function test_can_delete_owner()
    {
        $owner = InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->deleteJson("/api/v1/inmetro/owners/{$owner->id}");

        $response->assertOk()
            ->assertJsonFragment(['message' => 'Owner deleted successfully']);

        $this->assertDatabaseMissing('inmetro_owners', [
            'id' => $owner->id,
        ]);
    }

    public function test_cannot_delete_other_tenant_owner()
    {
        $otherTenant = Tenant::factory()->create();
        $otherOwner = InmetroOwner::factory()->create([
            'tenant_id' => $otherTenant->id,
        ]);

        $response = $this->deleteJson("/api/v1/inmetro/owners/{$otherOwner->id}");

        $response->assertNotFound();

        $this->assertDatabaseHas('inmetro_owners', [
            'id' => $otherOwner->id,
        ]);
    }

    public function test_can_update_lead_status()
    {
        $owner = InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'lead_status' => 'new',
        ]);

        $response = $this->patchJson("/api/v1/inmetro/owners/{$owner->id}/status", [
            'lead_status' => 'contacted',
            'notes' => 'Primeiro contato realizado',
        ]);

        $response->assertOk()
            ->assertJsonFragment(['lead_status' => 'contacted']);

        $this->assertDatabaseHas('inmetro_owners', [
            'id' => $owner->id,
            'lead_status' => 'contacted',
        ]);
    }

    public function test_leads_search_filters()
    {
        InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Balanças Super MT',
            'lead_status' => 'new',
        ]);

        InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Outro Proprietário',
            'lead_status' => 'contacted',
        ]);

        // Test search filter
        $response = $this->getJson('/api/v1/inmetro/leads?search=Super');
        $response->assertOk()
            ->assertJsonCount(1, 'data');

        // Test lead_status filter
        $response = $this->getJson('/api/v1/inmetro/leads?lead_status=contacted');
        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_leads_type_filter()
    {
        InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'type' => 'PJ',
            'lead_status' => 'new',
        ]);

        InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'type' => 'PF',
            'lead_status' => 'new',
        ]);

        $response = $this->getJson('/api/v1/inmetro/leads?type=PJ');
        $response->assertOk()
            ->assertJsonCount(1, 'data');

        $response = $this->getJson('/api/v1/inmetro/leads?type=PF');
        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_show_instrument_with_history()
    {
        $owner = InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $location = InmetroLocation::factory()->create([
            'owner_id' => $owner->id,
        ]);

        $instrument = InmetroInstrument::factory()->create([
            'location_id' => $location->id,
        ]);

        $response = $this->getJson("/api/v1/inmetro/instruments/{$instrument->id}");

        $response->assertOk()
            ->assertJsonStructure([
                'id', 'inmetro_number', 'brand', 'model',
                'current_status', 'history',
                'location' => ['address_city', 'owner' => ['id', 'name']],
            ]);
    }

    public function test_show_instrument_not_found_for_other_tenant()
    {
        $otherTenant = Tenant::factory()->create();
        $otherOwner = InmetroOwner::factory()->create([
            'tenant_id' => $otherTenant->id,
        ]);

        $location = InmetroLocation::factory()->create([
            'owner_id' => $otherOwner->id,
        ]);

        $instrument = InmetroInstrument::factory()->create([
            'location_id' => $location->id,
        ]);

        $response = $this->getJson("/api/v1/inmetro/instruments/{$instrument->id}");
        $response->assertNotFound();
    }

    public function test_conversion_stats_endpoint()
    {
        InmetroOwner::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'lead_status' => 'new',
        ]);

        InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'lead_status' => 'converted',
            'converted_to_customer_id' => 999,
        ]);

        $response = $this->getJson('/api/v1/inmetro/conversion-stats');

        $response->assertOk()
            ->assertJsonStructure([
                'total_leads',
                'converted',
                'conversion_rate',
                'avg_days_to_convert',
                'by_status',
                'recent_conversions',
            ]);

        $this->assertEquals(4, $response->json('total_leads'));
        $this->assertEquals(1, $response->json('converted'));
    }

    public function test_export_leads_csv()
    {
        InmetroOwner::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'lead_status' => 'new',
        ]);

        $response = $this->get('/api/v1/inmetro/export/leads');

        $response->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_update_lead_status_invalid_status()
    {
        $owner = InmetroOwner::factory()->create([
            'tenant_id' => $this->tenant->id,
            'lead_status' => 'new',
        ]);

        $response = $this->patchJson("/api/v1/inmetro/owners/{$owner->id}/status", [
            'lead_status' => 'invalid_status',
        ]);

        $response->assertUnprocessable();
    }
}

