<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantTest extends TestCase
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

    // ── Tenant CRUD ──

    public function test_list_tenants(): void
    {
        $response = $this->getJson('/api/v1/tenants');

        $response->assertOk();
    }

    public function test_create_tenant(): void
    {
        $response = $this->postJson('/api/v1/tenants', [
            'name' => 'Empresa Teste LTDA',
            'document' => '12.345.678/0001-90',
            'email' => 'contato@teste.com',
            'phone' => '(11) 99999-0000',
            'status' => Tenant::STATUS_ACTIVE,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Empresa Teste LTDA');

        $this->assertDatabaseHas('tenants', [
            'name' => 'Empresa Teste LTDA',
            'document' => '12.345.678/0001-90',
        ]);
    }

    public function test_create_tenant_with_trial_status(): void
    {
        $response = $this->postJson('/api/v1/tenants', [
            'name' => 'Empresa Trial',
            'status' => Tenant::STATUS_TRIAL,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', Tenant::STATUS_TRIAL);
    }

    public function test_create_tenant_defaults_to_active(): void
    {
        $response = $this->postJson('/api/v1/tenants', [
            'name' => 'Sem Status Explícito',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', Tenant::STATUS_ACTIVE);
    }

    public function test_create_tenant_rejects_invalid_status(): void
    {
        $response = $this->postJson('/api/v1/tenants', [
            'name' => 'Status Inválido',
            'status' => 'invalid_status',
        ]);

        $response->assertStatus(422);
    }

    public function test_show_tenant(): void
    {
        $response = $this->getJson("/api/v1/tenants/{$this->tenant->id}");

        $response->assertOk()
            ->assertJsonPath('id', $this->tenant->id)
            ->assertJsonPath('name', $this->tenant->name);
    }

    public function test_update_tenant(): void
    {
        $response = $this->putJson("/api/v1/tenants/{$this->tenant->id}", [
            'name' => 'Nome Atualizado',
            'status' => Tenant::STATUS_INACTIVE,
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'Nome Atualizado')
            ->assertJsonPath('status', Tenant::STATUS_INACTIVE);
    }

    public function test_destroy_tenant_without_dependencies(): void
    {
        $emptyTenant = Tenant::factory()->create();

        $response = $this->deleteJson("/api/v1/tenants/{$emptyTenant->id}");

        $response->assertStatus(204);
        $this->assertDatabaseMissing('tenants', ['id' => $emptyTenant->id]);
    }

    public function test_cannot_destroy_tenant_with_users(): void
    {
        // Tenant $this->tenant has $this->user attached
        $response = $this->deleteJson("/api/v1/tenants/{$this->tenant->id}");

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Não é possível excluir empresa com dados vinculados.')
            ->assertJsonPath('dependencies.users', 1)
            ->assertJsonMissing(['dependencies' => ['branches' => 0]]);
    }

    public function test_cannot_destroy_tenant_with_branches(): void
    {
        $tenant = Tenant::factory()->create();
        Branch::factory()->create(['tenant_id' => $tenant->id]);

        $response = $this->deleteJson("/api/v1/tenants/{$tenant->id}");

        $response->assertStatus(422)
            ->assertJsonPath('dependencies.branches', 1);
    }

    public function test_stats(): void
    {
        $response = $this->getJson('/api/v1/tenants-stats');

        $response->assertOk()
            ->assertJsonStructure(['total', 'active', 'trial', 'inactive']);
    }

    // ── Tenant User Invite/Remove ──

    public function test_invite_new_user(): void
    {
        $response = $this->postJson("/api/v1/tenants/{$this->tenant->id}/invite", [
            'name' => 'Novo Convidado',
            'email' => 'novo@teste.com',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('user.email', 'novo@teste.com');

        $this->assertDatabaseHas('users', ['email' => 'novo@teste.com']);
        $this->assertDatabaseHas('user_tenants', [
            'tenant_id' => $this->tenant->id,
            'user_id' => User::where('email', 'novo@teste.com')->first()->id,
        ]);
    }

    public function test_invite_existing_user(): void
    {
        $otherTenant = Tenant::factory()->create();
        $existingUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);

        $response = $this->postJson("/api/v1/tenants/{$this->tenant->id}/invite", [
            'name' => $existingUser->name,
            'email' => $existingUser->email,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('user_tenants', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $existingUser->id,
        ]);
    }

    public function test_cannot_invite_already_member(): void
    {
        $response = $this->postJson("/api/v1/tenants/{$this->tenant->id}/invite", [
            'name' => $this->user->name,
            'email' => $this->user->email,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Usuário já pertence a esta empresa.');
    }

    public function test_remove_user_from_tenant(): void
    {
        $extra = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->tenant->users()->attach($extra->id, ['is_default' => false]);

        $response = $this->deleteJson("/api/v1/tenants/{$this->tenant->id}/users/{$extra->id}");

        $response->assertStatus(204);
        $this->assertDatabaseMissing('user_tenants', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $extra->id,
        ]);
    }

    public function test_cannot_remove_nonmember_user(): void
    {
        $otherUser = User::factory()->create();

        $response = $this->deleteJson("/api/v1/tenants/{$this->tenant->id}/users/{$otherUser->id}");

        $response->assertStatus(404)
            ->assertJsonPath('message', 'Usuário não pertence a esta empresa.');
    }

    // ── Branch CRUD ──

    public function test_list_branches(): void
    {
        Branch::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->getJson('/api/v1/branches');

        $response->assertOk();
    }

    public function test_create_branch(): void
    {
        $response = $this->postJson('/api/v1/branches', [
            'name' => 'Filial Centro',
            'code' => 'FC01',
            'address_city' => 'São Paulo',
            'address_state' => 'SP',
            'email' => 'centro@empresa.com',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Filial Centro')
            ->assertJsonPath('code', 'FC01');

        $this->assertDatabaseHas('branches', [
            'name' => 'Filial Centro',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_show_branch(): void
    {
        $branch = Branch::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->getJson("/api/v1/branches/{$branch->id}");

        $response->assertOk()
            ->assertJsonPath('id', $branch->id);
    }

    public function test_cannot_show_branch_from_other_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignBranch = Branch::factory()->create(['tenant_id' => $otherTenant->id]);

        $response = $this->getJson("/api/v1/branches/{$foreignBranch->id}");

        $response->assertStatus(404);
    }

    public function test_update_branch(): void
    {
        $branch = Branch::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->putJson("/api/v1/branches/{$branch->id}", [
            'name' => 'Filial Atualizada',
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'Filial Atualizada');
    }

    public function test_destroy_branch(): void
    {
        $branch = Branch::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->deleteJson("/api/v1/branches/{$branch->id}");

        $response->assertStatus(204);
        $this->assertDatabaseMissing('branches', ['id' => $branch->id]);
    }

    public function test_cannot_destroy_branch_from_other_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignBranch = Branch::factory()->create(['tenant_id' => $otherTenant->id]);

        $response = $this->deleteJson("/api/v1/branches/{$foreignBranch->id}");

        $response->assertStatus(404);
    }

    public function test_cannot_create_branch_with_duplicate_code(): void
    {
        Branch::factory()->create([
            'tenant_id' => $this->tenant->id,
            'code' => 'UNIQUE01',
        ]);

        $response = $this->postJson('/api/v1/branches', [
            'name' => 'Outra Filial',
            'code' => 'UNIQUE01',
        ]);

        $response->assertStatus(422);
    }

    public function test_duplicate_code_allowed_across_tenants(): void
    {
        $otherTenant = Tenant::factory()->create();
        Branch::factory()->create([
            'tenant_id' => $otherTenant->id,
            'code' => 'SAME_CODE',
        ]);

        $response = $this->postJson('/api/v1/branches', [
            'name' => 'Minha Filial',
            'code' => 'SAME_CODE',
        ]);

        $response->assertStatus(201);
    }

    // ── Branch com code null ──

    public function test_create_branch_without_code(): void
    {
        $response = $this->postJson('/api/v1/branches', [
            'name' => 'Filial Sem Código',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Filial Sem Código');

        $this->assertDatabaseHas('branches', [
            'name' => 'Filial Sem Código',
            'code' => null,
            'tenant_id' => $this->tenant->id,
        ]);
    }

    // ── Invite com role inválida ──

    public function test_invite_user_with_invalid_role(): void
    {
        $response = $this->postJson("/api/v1/tenants/{$this->tenant->id}/invite", [
            'name' => 'Novo User',
            'email' => 'invalid-role@teste.com',
            'role' => 'nonexistent_role_xyz',
        ]);

        $response->assertStatus(422);
    }

    // ── TenantSetting ──

    public function test_tenant_setting_set_and_get_value(): void
    {
        \App\Models\TenantSetting::setValue($this->tenant->id, 'theme', ['mode' => 'dark']);

        $result = \App\Models\TenantSetting::getValue($this->tenant->id, 'theme');

        $this->assertIsArray($result);
        $this->assertEquals('dark', $result['mode']);
    }

    public function test_tenant_setting_get_returns_default_when_missing(): void
    {
        $result = \App\Models\TenantSetting::getValue($this->tenant->id, 'nonexistent_key', 'fallback');

        $this->assertEquals('fallback', $result);
    }

    public function test_tenant_setting_set_updates_existing(): void
    {
        \App\Models\TenantSetting::setValue($this->tenant->id, 'logo', ['url' => 'old.png']);
        \App\Models\TenantSetting::setValue($this->tenant->id, 'logo', ['url' => 'new.png']);

        $result = \App\Models\TenantSetting::getValue($this->tenant->id, 'logo');

        $this->assertEquals('new.png', $result['url']);
        $this->assertEquals(1, \App\Models\TenantSetting::withoutGlobalScope('tenant')
            ->where('tenant_id', $this->tenant->id)
            ->where('key', 'logo')
            ->count());
    }

    // ── Destroy com dependências expandidas ──

    public function test_destroy_tenant_shows_dependencies(): void
    {
        $tenantWithSettings = Tenant::factory()->create();
        $user = User::factory()->create([
            'tenant_id' => $tenantWithSettings->id,
            'current_tenant_id' => $tenantWithSettings->id,
        ]);
        $tenantWithSettings->users()->attach($user->id, ['is_default' => true]);

        \App\Models\TenantSetting::withoutGlobalScope('tenant')->create([
            'tenant_id' => $tenantWithSettings->id,
            'key' => 'test_key',
            'value_json' => ['v' => 1],
        ]);

        $response = $this->deleteJson("/api/v1/tenants/{$tenantWithSettings->id}");

        $response->assertStatus(422)
            ->assertJsonPath('dependencies.users', 1);
    }
}
