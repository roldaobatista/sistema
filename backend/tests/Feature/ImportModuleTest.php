<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Import module — fields, history, templates, upload, preview, stats.
 */
class ImportModuleTest extends TestCase
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

    public function test_import_fields_for_customers(): void
    {
        $response = $this->getJson('/api/v1/import/fields/customers');
        $response->assertOk();
    }

    public function test_import_fields_for_products(): void
    {
        $response = $this->getJson('/api/v1/import/fields/products');
        $response->assertOk();
    }

    public function test_import_history(): void
    {
        $response = $this->getJson('/api/v1/import/history');
        $response->assertOk();
    }

    public function test_import_templates_list(): void
    {
        $response = $this->getJson('/api/v1/import/templates');
        $response->assertOk();
    }

    public function test_import_stats(): void
    {
        $response = $this->getJson('/api/v1/import-stats');
        $response->assertOk();
    }

    public function test_import_entity_counts(): void
    {
        $response = $this->getJson('/api/v1/import-entity-counts');
        $response->assertOk();
    }

    public function test_import_upload_rejects_without_file(): void
    {
        $response = $this->postJson('/api/v1/import/upload', [
            'entity' => 'customers',
        ]);
        $response->assertStatus(422);
    }
}
