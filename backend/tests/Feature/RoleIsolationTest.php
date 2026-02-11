<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected User $userA;
    protected Tenant $tenantA;
    protected User $userB;
    protected Tenant $tenantB;

    protected function setUp(): void
    {
        parent::setUp();

        // Setup Tenant A
        $this->tenantA = Tenant::factory()->create(['name' => 'Tenant A']);
        $this->userA = User::factory()->create([
            'tenant_id' => $this->tenantA->id,
            'current_tenant_id' => $this->tenantA->id,
        ]);
        $this->userA->tenants()->attach($this->tenantA->id, ['is_default' => true]);

        // Setup Tenant B
        $this->tenantB = Tenant::factory()->create(['name' => 'Tenant B']);
        $this->userB = User::factory()->create([
            'tenant_id' => $this->tenantB->id,
            'current_tenant_id' => $this->tenantB->id,
        ]);
        $this->userB->tenants()->attach($this->tenantB->id, ['is_default' => true]);

        // Mock permission check to allow verified users to manage roles
        $this->withoutMiddleware(\App\Http\Middleware\CheckPermission::class);
    }

    public function test_can_create_roles_with_same_name_in_different_tenants(): void
    {
        // Tenant A creates 'Manager'
        Sanctum::actingAs($this->userA, ['*']);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $responseA = $this->postJson('/api/v1/roles', [
            'name' => 'Manager',
            'permissions' => []
        ]);
        $responseA->assertCreated();

        // Tenant B creates 'Manager'
        Sanctum::actingAs($this->userB, ['*']);
        app()->instance('current_tenant_id', $this->tenantB->id);

        $responseB = $this->postJson('/api/v1/roles', [
            'name' => 'Manager',
            'permissions' => []
        ]);
        if ($responseB->status() !== 201) {
            dump($responseB->json());
        }
        $responseB->assertCreated();

        // Verify database
        // Actually, we expect 2 'Manager' roles
        $managers = Role::withoutGlobalScopes()->where('name', 'Manager')->get();
        // file_put_contents('debug_test.txt', ...); // Debug removed

        $this->assertDatabaseCount('roles', 2); // 2 created (Manager A + Manager B), no system roles seeded
        $this->assertCount(2, $managers);
        $this->assertEquals($this->tenantA->id, $managers->first()->tenant_id);
        $this->assertEquals($this->tenantB->id, $managers->last()->tenant_id);
    }

    public function test_cannot_create_duplicate_role_in_same_tenant(): void
    {
        Sanctum::actingAs($this->userA, ['*']);
        app()->instance('current_tenant_id', $this->tenantA->id);

        // First create
        $this->postJson('/api/v1/roles', ['name' => 'Supervisor'])->assertCreated();

        // Second create same name
        $response = $this->postJson('/api/v1/roles', ['name' => 'Supervisor']);
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_roles_list_is_scoped_by_tenant(): void
    {
        // Create roles for A
        Role::create(['name' => 'RoleA', 'guard_name' => 'web', 'tenant_id' => $this->tenantA->id]);
        
        // Create roles for B
        Role::create(['name' => 'RoleB', 'guard_name' => 'web', 'tenant_id' => $this->tenantB->id]);

        // Create Global Role (system)
        Role::create(['name' => 'SystemRole', 'guard_name' => 'web', 'tenant_id' => null]);

        // Act as User A
        Sanctum::actingAs($this->userA, ['*']);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->getJson('/api/v1/roles');

        $response->assertOk();
        $names = collect($response->json())->pluck('name');

        $this->assertTrue($names->contains('RoleA'));
        $this->assertTrue($names->contains('SystemRole')); // Should see global
        $this->assertFalse($names->contains('RoleB')); // Should NOT see B
    }
}
