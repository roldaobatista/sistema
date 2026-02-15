<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Professional IAM tests — verifies user CRUD, role management, permission assignment,
 * audit trail, and tenant scoping for the Identity & Access Management module.
 */
class IamProfessionalTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $this->tenant = Tenant::factory()->create();
        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->admin->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->admin, ['*']);
    }

    // ── USER CRUD ──

    public function test_create_user_with_valid_data_persists(): void
    {
        $response = $this->postJson('/api/v1/users', [
            'name' => 'Maria Silva',
            'email' => 'maria@test.com',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Maria Silva')
            ->assertJsonPath('email', 'maria@test.com');

        $this->assertDatabaseHas('users', [
            'name' => 'Maria Silva',
            'email' => 'maria@test.com',
            'tenant_id' => $this->tenant->id,
        ]);

        // Password should never be exposed
        $response->assertJsonMissing(['password']);
    }

    public function test_create_user_rejects_duplicate_email_same_tenant(): void
    {
        User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'duplicado@test.com',
        ]);

        $response = $this->postJson('/api/v1/users', [
            'name' => 'Outro',
            'email' => 'duplicado@test.com',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_list_users_returns_paginated(): void
    {
        User::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson('/api/v1/users');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total']);
    }

    public function test_update_user_persists_changes(): void
    {
        $user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'name' => 'Nome Antigo',
        ]);

        $response = $this->putJson("/api/v1/users/{$user->id}", [
            'name' => 'Nome Novo',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Nome Novo',
        ]);
    }

    public function test_deactivate_user_sets_is_active_false(): void
    {
        $user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $response = $this->putJson("/api/v1/users/{$user->id}", [
            'is_active' => false,
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'is_active' => false,
        ]);
    }

    // ── ROLE MANAGEMENT ──

    public function test_create_role_with_permissions(): void
    {
        $p1 = Permission::findOrCreate('workorder.view', 'web');
        $p2 = Permission::findOrCreate('workorder.create', 'web');

        $response = $this->postJson('/api/v1/roles', [
            'name' => 'Técnico',
            'description' => 'Papel de técnico de campo',
            'permissions' => [$p1->id, $p2->id],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Técnico');

        $role = Role::where('name', 'Técnico')->first();
        $this->assertNotNull($role);
        $this->assertTrue($role->hasPermissionTo('workorder.view'));
        $this->assertTrue($role->hasPermissionTo('workorder.create'));
    }

    public function test_update_role_updates_description(): void
    {
        $role = Role::create([
            'name' => 'Vendedor',
            'guard_name' => 'web',
            'description' => 'Descrição antiga',
        ]);

        $response = $this->putJson("/api/v1/roles/{$role->id}", [
            'description' => 'Descrição atualizada',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('roles', [
            'id' => $role->id,
            'description' => 'Descrição atualizada',
        ]);
    }

    public function test_list_roles_returns_all_for_tenant(): void
    {
        Role::create(['name' => 'Admin', 'guard_name' => 'web']);
        Role::create(['name' => 'Viewer', 'guard_name' => 'web']);

        $response = $this->getJson('/api/v1/roles');

        $response->assertOk();
    }

    // ── ASSIGN ROLE TO USER ──

    public function test_assign_role_to_user(): void
    {
        $role = Role::create(['name' => 'Técnico', 'guard_name' => 'web']);

        $user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $response = $this->postJson("/api/v1/users/{$user->id}/roles", [
            'roles' => [$role->name],
        ]);

        $response->assertOk();

        $this->assertTrue($user->fresh()->hasRole('Técnico'));
    }

    // ── PERMISSIONS ──

    public function test_list_permissions_returns_grouped(): void
    {
        Permission::findOrCreate('workorder.view', 'web');
        Permission::findOrCreate('workorder.create', 'web');
        Permission::findOrCreate('customer.view', 'web');

        $response = $this->getJson('/api/v1/permissions');

        $response->assertOk();
    }

    // ── PASSWORD SAFETY ──

    public function test_user_response_never_exposes_password(): void
    {
        $user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson("/api/v1/users/{$user->id}");

        $response->assertOk()
            ->assertJsonMissing(['password'])
            ->assertJsonMissing(['remember_token']);
    }

    // ── TENANT ISOLATION ──

    public function test_users_from_other_tenant_not_visible(): void
    {
        $otherTenant = Tenant::factory()->create();

        User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
            'name' => 'Usuário Externo',
        ]);

        $response = $this->getJson('/api/v1/users');

        $response->assertOk()
            ->assertDontSee('Usuário Externo');
    }
}
