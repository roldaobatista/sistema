<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class IamTest extends TestCase
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

    /**
     * Helper: cria um usuário vinculado ao tenant de teste.
     */
    private function createTenantUser(array $overrides = []): User
    {
        $user = User::factory()->create(array_merge([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ], $overrides));

        // FIX-11: Sempre fazer attach ao tenant para que resolveTenantUser() funcione
        $user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        return $user;
    }

    // ── User CRUD ──

    public function test_create_user(): void
    {
        $response = $this->postJson('/api/v1/users', [
            'name' => 'João Técnico',
            'email' => 'joao@test.com',
            'password' => 'senha1234',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'João Técnico');

        $this->assertDatabaseHas('users', [
            'email' => 'joao@test.com',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_list_users(): void
    {
        $this->createTenantUser();

        $response = $this->getJson('/api/v1/users');

        $response->assertOk();
        $this->assertGreaterThanOrEqual(2, $response->json('total'));
    }

    public function test_show_user(): void
    {
        $response = $this->getJson("/api/v1/users/{$this->user->id}");

        $response->assertOk()
            ->assertJsonPath('id', $this->user->id);
    }

    public function test_update_user(): void
    {
        // FIX-11: Usar helper que faz attach ao tenant
        $target = $this->createTenantUser();

        $response = $this->putJson("/api/v1/users/{$target->id}", [
            'name' => 'Nome Atualizado',
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'Nome Atualizado');
    }

    public function test_cannot_access_user_from_other_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);
        $foreignUser->tenants()->attach($otherTenant->id, ['is_default' => true]);

        $this->getJson("/api/v1/users/{$foreignUser->id}")->assertStatus(404);
        $this->putJson("/api/v1/users/{$foreignUser->id}", ['name' => 'Sem acesso'])->assertStatus(404);
        $this->deleteJson("/api/v1/users/{$foreignUser->id}")->assertStatus(404);
    }

    public function test_delete_user(): void
    {
        // FIX-11: Usar helper que faz attach ao tenant
        $target = $this->createTenantUser();

        $response = $this->deleteJson("/api/v1/users/{$target->id}");

        $response->assertStatus(204);
    }

    public function test_cannot_delete_self(): void
    {
        $response = $this->deleteJson("/api/v1/users/{$this->user->id}");

        $response->assertStatus(422);
    }

    // ── Toggle Active ──

    public function test_toggle_user_active(): void
    {
        $target = $this->createTenantUser(['is_active' => true]);

        $response = $this->postJson("/api/v1/users/{$target->id}/toggle-active");

        $response->assertOk()
            ->assertJsonPath('is_active', false);
    }

    public function test_cannot_toggle_self_active(): void
    {
        $response = $this->postJson("/api/v1/users/{$this->user->id}/toggle-active");

        $response->assertStatus(422);
    }

    // ── Reset Password ──

    public function test_reset_password(): void
    {
        $target = $this->createTenantUser();

        $response = $this->postJson("/api/v1/users/{$target->id}/reset-password", [
            'password' => 'novaSenha123',
            'password_confirmation' => 'novaSenha123',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Senha atualizada.');

        // FIX-12: Verificar que a senha realmente mudou
        $target->refresh();
        $this->assertTrue(Hash::check('novaSenha123', $target->password));
    }

    // ── Change Own Password ──

    public function test_change_own_password(): void
    {
        $this->user->update(['password' => 'senhaAtual123']);

        $response = $this->postJson('/api/v1/profile/change-password', [
            'current_password' => 'senhaAtual123',
            'new_password' => 'novaSenha456',
            'new_password_confirmation' => 'novaSenha456',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Senha alterada com sucesso.');

        // FIX-12: Verificar que a senha realmente mudou
        $this->user->refresh();
        $this->assertTrue(Hash::check('novaSenha456', $this->user->password));
    }

    public function test_change_password_wrong_current(): void
    {
        $this->user->update(['password' => 'senhaCorreta']);

        $response = $this->postJson('/api/v1/profile/change-password', [
            'current_password' => 'senhaErrada',
            'new_password' => 'novaSenha456',
            'new_password_confirmation' => 'novaSenha456',
        ]);

        $response->assertStatus(422);
    }

    // ── Roles CRUD ──

    public function test_create_role(): void
    {
        $response = $this->postJson('/api/v1/roles', [
            'name' => 'supervisor',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'supervisor');
    }

    public function test_list_roles(): void
    {
        Role::create(['name' => 'gerente', 'guard_name' => 'web']);

        $response = $this->getJson('/api/v1/roles');

        // FIX-10: Não aceitar 500 como sucesso. Deve ser 200.
        $response->assertOk();
    }

    public function test_show_role(): void
    {
        $role = Role::create(['name' => 'coordenador', 'guard_name' => 'web']);

        $response = $this->getJson("/api/v1/roles/{$role->id}");

        $response->assertOk()
            ->assertJsonPath('name', 'coordenador');
    }

    public function test_update_role(): void
    {
        $role = Role::create(['name' => 'operador', 'guard_name' => 'web']);

        $response = $this->putJson("/api/v1/roles/{$role->id}", [
            'name' => 'operador_sr',
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'operador_sr');
    }

    public function test_delete_role(): void
    {
        $role = Role::create(['name' => 'temp_role', 'guard_name' => 'web']);

        $response = $this->deleteJson("/api/v1/roles/{$role->id}");

        $response->assertStatus(204);
    }

    // ── Role Protection ──

    public function test_cannot_edit_super_admin(): void
    {
        $role = Role::create(['name' => 'super_admin', 'guard_name' => 'web']);

        $response = $this->putJson("/api/v1/roles/{$role->id}", [
            'name' => 'hacked',
        ]);

        $response->assertStatus(422);
    }

    public function test_cannot_delete_admin(): void
    {
        $role = Role::create(['name' => 'admin', 'guard_name' => 'web']);

        $response = $this->deleteJson("/api/v1/roles/{$role->id}");

        $response->assertStatus(422);
    }

    // ── Role with Permissions ──

    public function test_create_role_with_permissions(): void
    {
        $perm = Permission::create(['name' => 'view_reports', 'guard_name' => 'web']);

        $response = $this->postJson('/api/v1/roles', [
            'name' => 'analista',
            'permissions' => [$perm->id],
        ]);

        $response->assertStatus(201);

        $role = Role::where('name', 'analista')->first();
        $this->assertNotNull($role);
        $this->assertTrue($role->permissions->contains('name', 'view_reports'));
    }

    // ── By Role Endpoint ──

    public function test_list_users_by_role(): void
    {
        $role = Role::create(['name' => 'tecnico', 'guard_name' => 'web']);
        $target = $this->createTenantUser(['is_active' => true]);
        $target->assignRole($role);

        $response = $this->getJson('/api/v1/users/by-role/tecnico');

        $response->assertOk();
        $this->assertTrue(
            collect($response->json())->contains('id', $target->id)
        );
    }

    // ── Permissions Endpoints ──

    public function test_permissions_index(): void
    {
        $response = $this->getJson('/api/v1/permissions');

        $response->assertOk();
    }

    public function test_permissions_matrix(): void
    {
        $response = $this->getJson('/api/v1/permissions/matrix');

        $response->assertOk()
            ->assertJsonStructure(['roles', 'matrix']);
    }

    // ── Additional Role Protection ──

    public function test_cannot_rename_admin_role(): void
    {
        $role = Role::create(['name' => 'admin', 'guard_name' => 'web']);

        $response = $this->putJson("/api/v1/roles/{$role->id}", [
            'name' => 'admin_renamed',
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseHas('roles', ['id' => $role->id, 'name' => 'admin']);
    }

    public function test_cannot_delete_role_with_users(): void
    {
        $role = Role::create(['name' => 'temp_assigned', 'guard_name' => 'web']);
        $target = $this->createTenantUser();
        $target->assignRole($role);

        $response = $this->deleteJson("/api/v1/roles/{$role->id}");

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'Esta role possui usuários atribuídos. Remova os usuários antes de excluí-la.']);
    }

    // ── Password Validation ──

    public function test_change_password_too_short(): void
    {
        $this->user->update(['password' => 'senhaAtual123']);

        $response = $this->postJson('/api/v1/profile/change-password', [
            'current_password' => 'senhaAtual123',
            'new_password' => '123',
            'new_password_confirmation' => '123',
        ]);

        $response->assertStatus(422);
    }

    // ── FIX-13: Duplicate Email ──

    public function test_cannot_create_user_with_duplicate_email(): void
    {
        $existing = $this->createTenantUser(['email' => 'duplicado@test.com']);

        $response = $this->postJson('/api/v1/users', [
            'name' => 'Outro User',
            'email' => 'duplicado@test.com',
            'password' => 'senha1234',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    // ── FIX-15: Required Fields Validation ──

    public function test_cannot_create_user_without_required_fields(): void
    {
        $response = $this->postJson('/api/v1/users', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    // ── FIX-14: Auth Tests ──

    public function test_login_with_valid_credentials(): void
    {
        $this->withMiddleware();

        $user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
            'password' => 'senhaLogin123',
        ]);
        $user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $response = $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'senhaLogin123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'permissions', 'roles']]);
    }

    public function test_login_with_invalid_credentials(): void
    {
        $this->withMiddleware();

        $response = $this->postJson('/api/v1/login', [
            'email' => 'inexistente@test.com',
            'password' => 'senhaErrada',
        ]);

        $response->assertStatus(422);
    }

    public function test_logout(): void
    {
        $response = $this->postJson('/api/v1/logout');

        $response->assertOk()
            ->assertJsonPath('message', 'Logout realizado.');
    }

    public function test_switch_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();
        $this->user->tenants()->attach($otherTenant->id, ['is_default' => false]);

        $response = $this->postJson('/api/v1/switch-tenant', [
            'tenant_id' => $otherTenant->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('tenant_id', $otherTenant->id);

        $this->user->refresh();
        $this->assertEquals($otherTenant->id, $this->user->current_tenant_id);
    }

    public function test_cannot_switch_to_unauthorized_tenant(): void
    {
        $foreignTenant = Tenant::factory()->create();

        $response = $this->postJson('/api/v1/switch-tenant', [
            'tenant_id' => $foreignTenant->id,
        ]);

        $response->assertStatus(403);
    }

    // ──── Tests for new endpoints ────

    public function test_list_user_sessions(): void
    {
        $target = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $target->tenants()->attach($this->tenant->id, ['is_default' => true]);
        $target->createToken('test-token');

        $response = $this->getJson("/api/v1/users/{$target->id}/sessions");

        $response->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'last_used_at', 'created_at', 'is_current']]]);
    }

    public function test_bulk_toggle_active(): void
    {
        $targets = User::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $targets->each(fn ($u) => $u->tenants()->attach($this->tenant->id, ['is_default' => true]));

        $response = $this->postJson('/api/v1/users/bulk-toggle-active', [
            'user_ids' => $targets->pluck('id')->toArray(),
            'is_active' => false,
        ]);

        $response->assertOk()
            ->assertJsonPath('affected', 3);

        foreach ($targets as $target) {
            $target->refresh();
            $this->assertFalse($target->is_active);
        }
    }

    public function test_export_users_csv(): void
    {
        $response = $this->get('/api/v1/users/export');

        $response->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_clone_role(): void
    {
        $original = Role::create([
            'name' => 'clone-source',
            'guard_name' => 'web',
            'tenant_id' => $this->tenant->id,
        ]);

        $perm = Permission::firstOrCreate(
            ['name' => 'iam.user.view', 'guard_name' => 'web'],
            ['group_id' => null, 'criticality' => 'LOW']
        );
        $original->givePermissionTo($perm);

        $response = $this->postJson("/api/v1/roles/{$original->id}/clone", [
            'name' => 'clone-target',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'clone-target');

        $cloned = Role::where('name', 'clone-target')->first();
        $this->assertNotNull($cloned);
        $this->assertTrue($cloned->hasPermissionTo('iam.user.view'));
    }

    public function test_clone_protected_role(): void
    {
        $admin = Role::create([
            'name' => 'admin',
            'guard_name' => 'web',
            'tenant_id' => $this->tenant->id,
        ]);

        $perm = Permission::firstOrCreate(
            ['name' => 'iam.user.view', 'guard_name' => 'web'],
            ['group_id' => null, 'criticality' => 'LOW']
        );
        $admin->givePermissionTo($perm);

        $response = $this->postJson("/api/v1/roles/{$admin->id}/clone", [
            'name' => 'admin-clone',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'admin-clone');

        $cloned = Role::where('name', 'admin-clone')->first();
        $this->assertNotNull($cloned);
        $this->assertTrue($cloned->hasPermissionTo('iam.user.view'));
    }

    public function test_force_logout_user(): void
    {
        $target = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $target->tenants()->attach($this->tenant->id, ['is_default' => true]);
        $target->createToken('session-1');
        $target->createToken('session-2');

        $response = $this->postJson("/api/v1/users/{$target->id}/force-logout");

        $response->assertOk()
            ->assertJsonPath('revoked', 2);

        $this->assertEquals(0, $target->tokens()->count());
    }

    public function test_cannot_force_logout_self(): void
    {
        $response = $this->postJson("/api/v1/users/{$this->user->id}/force-logout");

        $response->assertStatus(422);
    }

    public function test_list_role_users(): void
    {
        $role = Role::create([
            'name' => 'suporte',
            'guard_name' => 'web',
            'tenant_id' => $this->tenant->id,
        ]);
        $target = $this->createTenantUser(['is_active' => true]);
        $target->assignRole($role);

        $response = $this->getJson("/api/v1/roles/{$role->id}/users");

        $response->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'email', 'is_active']]]);

        $this->assertTrue(
            collect($response->json('data'))->contains('id', $target->id)
        );
    }

    public function test_toggle_permission(): void
    {
        $role = Role::create([
            'name' => 'toggle-test',
            'guard_name' => 'web',
            'tenant_id' => $this->tenant->id,
        ]);
        $perm = Permission::firstOrCreate(
            ['name' => 'iam.toggle.test', 'guard_name' => 'web'],
            ['group_id' => null, 'criticality' => 'LOW']
        );

        // Grant
        $response = $this->postJson('/api/v1/permissions/toggle', [
            'role_id' => $role->id,
            'permission_id' => $perm->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('granted', true);

        $role->refresh();
        $this->assertTrue($role->hasPermissionTo($perm));

        // Revoke
        $response2 = $this->postJson('/api/v1/permissions/toggle', [
            'role_id' => $role->id,
            'permission_id' => $perm->id,
        ]);

        $response2->assertOk()
            ->assertJsonPath('granted', false);

        app()->make(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        $role->refresh();
        $this->assertFalse($role->hasPermissionTo($perm));
    }

    public function test_cannot_toggle_super_admin_permission(): void
    {
        $superAdmin = Role::create([
            'name' => 'super_admin',
            'guard_name' => 'web',
            'tenant_id' => $this->tenant->id,
        ]);
        $perm = Permission::firstOrCreate(
            ['name' => 'iam.toggle.block', 'guard_name' => 'web'],
            ['group_id' => null, 'criticality' => 'LOW']
        );

        $response = $this->postJson('/api/v1/permissions/toggle', [
            'role_id' => $superAdmin->id,
            'permission_id' => $perm->id,
        ]);

        $response->assertStatus(422);
    }
}
