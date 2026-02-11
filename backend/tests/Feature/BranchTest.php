<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BranchTest extends TestCase
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

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_index_returns_only_tenant_branches(): void
    {
        // Branch do tenant atual
        Branch::factory()->create(['tenant_id' => $this->tenant->id, 'name' => 'Filial A']);
        
        // Branch de outro tenant
        $otherTenant = Tenant::factory()->create();
        Branch::factory()->create(['tenant_id' => $otherTenant->id, 'name' => 'Filial B']);

        $response = $this->getJson('/api/v1/branches');

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['name' => 'Filial A'])
            ->assertJsonMissing(['name' => 'Filial B']);
    }

    public function test_store_creates_branch_for_current_tenant(): void
    {
        $payload = [
            'name' => 'Nova Filial',
            'code' => 'FIL-001',
            'address_city' => 'São Paulo',
        ];

        $response = $this->postJson('/api/v1/branches', $payload);

        $response->assertCreated()
            ->assertJsonFragment(['name' => 'Nova Filial']);

        $this->assertDatabaseHas('branches', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Nova Filial',
            'code' => 'FIL-001',
        ]);
    }

    public function test_show_fails_for_other_tenant_branch(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherBranch = Branch::factory()->create(['tenant_id' => $otherTenant->id]);

        $response = $this->getJson("/api/v1/branches/{$otherBranch->id}");

        $response->assertNotFound();
    }

    public function test_update_fails_for_other_tenant_branch(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherBranch = Branch::factory()->create(['tenant_id' => $otherTenant->id]);

        $response = $this->putJson("/api/v1/branches/{$otherBranch->id}", [
            'name' => 'Hacked Branch',
        ]);

        $response->assertNotFound();
    }

    public function test_destroy_fails_for_other_tenant_branch(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherBranch = Branch::factory()->create(['tenant_id' => $otherTenant->id]);

        $response = $this->deleteJson("/api/v1/branches/{$otherBranch->id}");

        $response->assertNotFound();
    }
}
