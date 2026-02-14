<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * External APIs (CEP, CNPJ, holidays, banks, states)
 * + TechSync (pull, batch push).
 */
class ExternalApiTechSyncTest extends TestCase
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

    // ── EXTERNAL APIs ──

    public function test_cep_lookup(): void
    {
        $response = $this->getJson('/api/v1/external/cep/01001000');
        $response->assertOk();
    }

    public function test_cnpj_lookup(): void
    {
        $response = $this->getJson('/api/v1/external/cnpj/11222333000181');
        $response->assertOk();
    }

    public function test_holidays_for_year(): void
    {
        $response = $this->getJson('/api/v1/external/holidays/2025');
        $response->assertOk();
    }

    public function test_banks_list(): void
    {
        $response = $this->getJson('/api/v1/external/banks');
        $response->assertOk();
    }

    public function test_states_list(): void
    {
        $response = $this->getJson('/api/v1/external/states');
        $response->assertOk();
    }

    public function test_cities_by_state(): void
    {
        $response = $this->getJson('/api/v1/external/states/SP/cities');
        $response->assertOk();
    }

    // ── TECH SYNC ──

    public function test_tech_sync_pull(): void
    {
        $response = $this->getJson('/api/v1/tech/sync');
        $response->assertOk();
    }

    public function test_tech_sync_batch_push(): void
    {
        $response = $this->postJson('/api/v1/tech/sync/batch', [
            'updates' => [],
        ]);
        $response->assertOk();
    }
}
