<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Branch CRUD + Tenant Management — listing, creation, stats, invite.
 */
class BranchTenantTest extends TestCase
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

    // ── BRANCHES ──

    public function test_list_branches(): void
    {
        $response = $this->getJson('/api/v1/branches');
        $response->assertOk();
    }

    public function test_create_branch(): void
    {
        $response = $this->postJson('/api/v1/branches', [
            'name' => 'Filial São Paulo',
            'is_active' => true,
        ]);
        $response->assertCreated();
    }

    public function test_update_branch(): void
    {
        $response = $this->postJson('/api/v1/branches', [
            'name' => 'Filial Original',
        ]);

        $response->assertCreated();

        $branchId = $response->json('id');
        $updateResponse = $this->putJson("/api/v1/branches/{$branchId}", [
            'name' => 'Filial Atualizada',
        ]);
        $updateResponse->assertOk();
    }

    // ── TENANTS ──

    public function test_list_tenants(): void
    {
        $response = $this->getJson('/api/v1/tenants');
        $response->assertOk();
    }

    public function test_show_tenant(): void
    {
        $response = $this->getJson("/api/v1/tenants/{$this->tenant->id}");
        $response->assertOk();
    }

    public function test_tenant_stats(): void
    {
        $response = $this->getJson('/api/v1/tenants-stats');
        $response->assertOk();
    }

    public function test_invite_user_to_tenant(): void
    {
        $response = $this->postJson("/api/v1/tenants/{$this->tenant->id}/invite", [
            'name' => 'Novo Usuário',
            'email' => 'novo.usuario@empresa.com',
        ]);
        $response->assertCreated();
    }
}
