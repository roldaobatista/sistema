<?php

namespace Tests\Feature;

use App\Models\AuvoIdMapping;
use App\Models\AuvoImport;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuvoImportControllerTest extends TestCase
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
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── Test Connection ──

    public function test_test_connection_returns_status(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response([
                'result' => ['accessToken' => 'test-token'],
            ]),
            'api.auvo.com.br/v2/*' => Http::response(['result' => ['totalCount' => 5]]),
        ]);

        $response = $this->getJson('/api/v1/auvo/status');

        $response->assertOk()
            ->assertJsonStructure(['connected', 'message']);
    }

    public function test_test_connection_returns_failure_when_no_credentials(): void
    {
        config(['services.auvo.api_key' => null, 'services.auvo.api_token' => null]);

        $response = $this->getJson('/api/v1/auvo/status');

        $response->assertOk()
            ->assertJsonPath('connected', false);
    }

    // ── Preview ──

    public function test_preview_returns_sample_for_valid_entity(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::response([
                'result' => [
                    'entityList' => [
                         ['id' => 1, 'name' => 'Test Co', 'description' => 'Test Co'],
                    ],
                ],
            ]),
        ]);

        $response = $this->getJson('/api/v1/auvo/preview/customers');

        $response->assertOk()
            ->assertJsonStructure(['entity', 'total', 'sample', 'mapped_fields']);
    }

    public function test_preview_returns_422_for_invalid_entity(): void
    {
        $response = $this->getJson('/api/v1/auvo/preview/invalid_entity');

        $response->assertStatus(422);
    }

    // ── Import ──

    public function test_import_entity_returns_results(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::sequence()
                ->push([
                    'result' => [
                        'entityList' => [
                           [
                                'id' => 1,
                                'description' => 'Import Test',
                                'cpfCnpj' => '99.888.777/0001-66',
                            ],
                        ],
                    ],
                ], 200)
                ->push(['result' => []], 200),
        ]);

        $response = $this->postJson('/api/v1/auvo/import/customers', [
            'strategy' => 'skip',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['import_id', 'entity_type', 'total_imported', 'status']);
    }

    public function test_import_rejects_invalid_entity(): void
    {
        $response = $this->postJson('/api/v1/auvo/import/nonexistent', [
            'strategy' => 'skip',
        ]);

        $response->assertStatus(422);
    }

    // ── Import All ──

    public function test_import_all_processes_entities(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/*' => Http::response(['result' => []], 200),
        ]);

        $response = $this->postJson('/api/v1/auvo/import-all', [
            'strategy' => 'skip',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['message', 'summary', 'details']);
    }

    // ── History ──

    public function test_history_returns_imports(): void
    {
        AuvoImport::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => 'customers',
            'status' => 'done',
            'total_fetched' => 10,
            'total_imported' => 8,
            'total_updated' => 1,
            'total_skipped' => 1,
            'total_errors' => 0,
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/auvo/history');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total'])
            ->assertJsonPath('total', 1);
    }

    public function test_history_only_shows_own_tenant(): void
    {
        AuvoImport::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => 'customers',
            'status' => 'done',
            'total_fetched' => 5,
            'total_imported' => 5,
            'started_at' => now(),
        ]);

        $otherTenant = Tenant::factory()->create();
        $otherUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);

        AuvoImport::create([
            'tenant_id' => $otherTenant->id,
            'user_id' => $otherUser->id,
            'entity_type' => 'customers',
            'status' => 'done',
            'total_fetched' => 5,
            'total_imported' => 5,
            'started_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/auvo/history');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ── Rollback ──

    public function test_rollback_completed_import(): void
    {
        $import = AuvoImport::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => 'customers',
            'status' => 'done',
            'total_fetched' => 1,
            'total_imported' => 1,
            'imported_ids' => [999],
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        Http::fake([
            'api.auvo.com.br/v2/*' => Http::response([], 200),
        ]);

        $response = $this->postJson("/api/v1/auvo/rollback/{$import->id}");

        $response->assertOk()
            ->assertJsonStructure(['message', 'result']);

        $import->refresh();
        $this->assertEquals('rolled_back', $import->status);
    }

    public function test_rollback_rejects_non_completed(): void
    {
        $import = AuvoImport::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => 'customers',
            'status' => 'failed',
            'total_fetched' => 0,
            'total_imported' => 0,
            'started_at' => now(),
        ]);

        $response = $this->postJson("/api/v1/auvo/rollback/{$import->id}");

        $response->assertStatus(422);
    }

    public function test_rollback_returns_404_for_other_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);

        $import = AuvoImport::create([
            'tenant_id' => $otherTenant->id,
            'user_id' => $otherUser->id,
            'entity_type' => 'customers',
            'status' => 'done',
            'total_fetched' => 1,
            'total_imported' => 1,
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        $response = $this->postJson("/api/v1/auvo/rollback/{$import->id}");

        $response->assertStatus(404);
    }

    // ── Mappings ──

    public function test_mappings_returns_paginated_data(): void
    {
        AuvoIdMapping::create([
            'tenant_id' => $this->tenant->id,
            'entity_type' => 'customers',
            'auvo_id' => '100',
            'local_id' => 1,
        ]);

        $response = $this->getJson('/api/v1/auvo/mappings');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total'])
            ->assertJsonPath('total', 1);
    }

    public function test_mappings_filters_by_entity(): void
    {
        AuvoIdMapping::create([
            'tenant_id' => $this->tenant->id,
            'entity_type' => 'customers',
            'auvo_id' => '100',
            'local_id' => 1,
        ]);

        AuvoIdMapping::create([
            'tenant_id' => $this->tenant->id,
            'entity_type' => 'products',
            'auvo_id' => '200',
            'local_id' => 2,
        ]);

        $response = $this->getJson('/api/v1/auvo/mappings?entity=customers');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ── Sync Status ──

    public function test_sync_status_returns_entity_breakdown(): void
    {
        AuvoImport::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => 'customers',
            'status' => 'done',
            'total_fetched' => 10,
            'total_imported' => 8,
            'total_errors' => 2,
            'started_at' => now()->subHour(),
            'completed_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/auvo/sync-status');

        $response->assertOk()
            ->assertJsonStructure(['entities', 'total_mappings']);
    }

    // ── Config ──

    public function test_config_validates_required_fields(): void
    {
        $response = $this->putJson('/api/v1/auvo/config', []);

        $response->assertStatus(422);
    }

    public function test_config_saves_credentials(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
        ]);

        $response = $this->putJson('/api/v1/auvo/config', [
            'api_key' => 'new-key',
            'api_token' => 'new-token',
        ]);

        $response->assertOk()
            ->assertJsonPath('saved', true);
    }
}
