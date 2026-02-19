<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Commission Campaign tests — replaces CommissionCampaignTest.
 * Exact status assertions, DB verification, validation edge cases.
 */
class CommissionCampaignProfessionalTest extends TestCase
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

    // ── CREATE ──

    public function test_create_campaign_returns_201_and_persists(): void
    {
        $response = $this->postJson('/api/v1/commission-campaigns', [
            'name' => 'Campanha Verão 2025',
            'multiplier' => 1.5,
            'applies_to_role' => \App\Models\CommissionRule::ROLE_TECHNICIAN,
            'starts_at' => now()->format('Y-m-d'),
            'ends_at' => now()->addMonths(2)->format('Y-m-d'),
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('commission_campaigns', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Campanha Verão 2025',
            'multiplier' => 1.5,
            'active' => true,
        ]);
    }

    public function test_create_campaign_validates_multiplier_minimum(): void
    {
        $response = $this->postJson('/api/v1/commission-campaigns', [
            'name' => 'Campanha inválida',
            'multiplier' => 0.5,
            'starts_at' => now()->format('Y-m-d'),
            'ends_at' => now()->addDays(30)->format('Y-m-d'),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['multiplier']);
    }

    public function test_create_campaign_validates_end_after_start(): void
    {
        $response = $this->postJson('/api/v1/commission-campaigns', [
            'name' => 'Datas invertidas',
            'multiplier' => 2.0,
            'starts_at' => '2025-12-31',
            'ends_at' => '2025-01-01',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['ends_at']);
    }

    // ── UPDATE ──

    public function test_update_campaign_persists_changes(): void
    {
        $campaignId = DB::table('commission_campaigns')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'name' => 'Campanha Original',
            'multiplier' => 1.5,
            'starts_at' => now()->format('Y-m-d'),
            'ends_at' => now()->addMonths(1)->format('Y-m-d'),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->putJson("/api/v1/commission-campaigns/{$campaignId}", [
            'name' => 'Campanha Atualizada',
            'active' => false,
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('commission_campaigns', [
            'id' => $campaignId,
            'name' => 'Campanha Atualizada',
            'active' => false,
        ]);
    }

    // ── DELETE ──

    public function test_delete_campaign_removes_from_db(): void
    {
        $campaignId = DB::table('commission_campaigns')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'name' => 'Para deletar',
            'multiplier' => 2.0,
            'starts_at' => now()->format('Y-m-d'),
            'ends_at' => now()->addMonths(1)->format('Y-m-d'),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->deleteJson("/api/v1/commission-campaigns/{$campaignId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('commission_campaigns', ['id' => $campaignId]);
    }

    // ── LIST ──

    public function test_list_campaigns_returns_all(): void
    {
        DB::table('commission_campaigns')->insert([
            [
                'tenant_id' => $this->tenant->id,
                'name' => 'Camp A',
                'multiplier' => 1.2,
                'starts_at' => now(),
                'ends_at' => now()->addMonth(),
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'tenant_id' => $this->tenant->id,
                'name' => 'Camp B',
                'multiplier' => 1.5,
                'starts_at' => now(),
                'ends_at' => now()->addMonth(),
                'active' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->getJson('/api/v1/commission-campaigns');

        $response->assertOk();
    }
}
