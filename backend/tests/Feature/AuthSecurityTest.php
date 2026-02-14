<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Auth Security Tests — validates authentication, token management,
 * brute force protection, tenant switching, and password changes.
 *
 * These tests run WITH real middleware (no withoutMiddleware) to validate
 * production-level security behavior.
 */
class AuthSecurityTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Tenant $otherTenant;
    private User $activeUser;
    private User $inactiveUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->otherTenant = Tenant::factory()->create();

        $this->activeUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'email' => 'active@test.com',
            'password' => Hash::make('senha1234'),
            'is_active' => true,
        ]);
        $this->activeUser->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $this->inactiveUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'email' => 'inactive@test.com',
            'password' => Hash::make('senha1234'),
            'is_active' => false,
        ]);
        $this->inactiveUser->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
    }

    // ── LOGIN SUCCESS ──

    public function test_login_with_valid_credentials_returns_token(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'email' => 'active@test.com',
            'password' => 'senha1234',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email', 'tenant_id', 'permissions', 'roles'],
            ]);

        $this->assertNotEmpty($response->json('token'));
        $this->assertEquals($this->activeUser->id, $response->json('user.id'));
    }

    public function test_login_updates_last_login_at(): void
    {
        $this->assertNull($this->activeUser->last_login_at);

        $this->postJson('/api/v1/login', [
            'email' => 'active@test.com',
            'password' => 'senha1234',
        ])->assertOk();

        $this->activeUser->refresh();
        $this->assertNotNull($this->activeUser->last_login_at);
    }

    // ── LOGIN FAILURES ──

    public function test_login_with_wrong_password_returns_422(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'email' => 'active@test.com',
            'password' => 'wrong_password',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_login_with_nonexistent_email_returns_422(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'email' => 'nobody@nowhere.com',
            'password' => 'senha1234',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_login_with_inactive_user_returns_403(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'email' => 'inactive@test.com',
            'password' => 'senha1234',
        ]);

        $response->assertForbidden()
            ->assertJsonPath('message', 'Conta desativada.');
    }

    public function test_login_without_email_returns_422(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'password' => 'senha1234',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_login_without_password_returns_422(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'email' => 'active@test.com',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }

    // ── BRUTE FORCE PROTECTION ──

    public function test_login_rate_limiting_blocks_after_5_attempts(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/login', [
                'email' => 'active@test.com',
                'password' => 'wrong',
            ]);
        }

        $response = $this->postJson('/api/v1/login', [
            'email' => 'active@test.com',
            'password' => 'wrong',
        ]);

        $response->assertStatus(429)
            ->assertJsonFragment(['message' => $response->json('message')]);

        $this->assertStringContainsString('Muitas tentativas', $response->json('message'));
    }

    public function test_successful_login_clears_failed_attempts(): void
    {
        // Make 3 failed attempts
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/login', [
                'email' => 'active@test.com',
                'password' => 'wrong',
            ]);
        }

        // Successful login should clear counter
        $this->postJson('/api/v1/login', [
            'email' => 'active@test.com',
            'password' => 'senha1234',
        ])->assertOk();

        // 5 more failed attempts should work (counter was reset)
        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/v1/login', [
                'email' => 'active@test.com',
                'password' => 'wrong',
            ])->assertStatus(422);
        }
    }

    // ── PROTECTED ROUTES WITHOUT TOKEN ──

    public function test_access_me_without_token_returns_401(): void
    {
        $response = $this->getJson('/api/v1/me');
        $response->assertUnauthorized();
    }

    public function test_access_protected_route_without_token_returns_401(): void
    {
        $response = $this->getJson('/api/v1/customers');
        $response->assertUnauthorized();
    }

    // ── LOGOUT ──

    public function test_logout_invalidates_token(): void
    {
        // Login to get a token
        $loginResponse = $this->postJson('/api/v1/login', [
            'email' => 'active@test.com',
            'password' => 'senha1234',
        ]);
        $token = $loginResponse->json('token');

        // Logout
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logout realizado.');

        // Try to use the token again
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/me')
            ->assertUnauthorized();
    }

    // ── ME ENDPOINT ──

    public function test_me_returns_authenticated_user_data(): void
    {
        Sanctum::actingAs($this->activeUser, ['*']);

        $response = $this->getJson('/api/v1/me');

        $response->assertOk()
            ->assertJsonStructure([
                'user' => ['id', 'name', 'email', 'permissions', 'roles'],
            ])
            ->assertJsonPath('user.id', $this->activeUser->id)
            ->assertJsonPath('user.email', 'active@test.com');
    }

    public function test_me_does_not_expose_password(): void
    {
        Sanctum::actingAs($this->activeUser, ['*']);

        $response = $this->getJson('/api/v1/me');
        $responseBody = $response->json();

        $this->assertArrayNotHasKey('password', $responseBody['user']);
        $this->assertStringNotContainsString('password', json_encode($responseBody));
    }

    // ── TENANT SWITCHING ──

    public function test_switch_tenant_changes_context(): void
    {
        $this->activeUser->tenants()->attach($this->otherTenant->id, ['is_default' => false]);
        Sanctum::actingAs($this->activeUser, ['*']);

        $response = $this->postJson('/api/v1/switch-tenant', [
            'tenant_id' => $this->otherTenant->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('tenant_id', $this->otherTenant->id);

        $this->activeUser->refresh();
        $this->assertEquals($this->otherTenant->id, $this->activeUser->current_tenant_id);
    }

    public function test_switch_tenant_to_unauthorized_tenant_returns_403(): void
    {
        Sanctum::actingAs($this->activeUser, ['*']);

        $response = $this->postJson('/api/v1/switch-tenant', [
            'tenant_id' => $this->otherTenant->id, // Not attached
        ]);

        $response->assertForbidden()
            ->assertJsonPath('message', 'Acesso negado a esta empresa.');
    }

    public function test_my_tenants_returns_only_accessible_tenants(): void
    {
        $this->activeUser->tenants()->attach($this->otherTenant->id, ['is_default' => false]);
        Sanctum::actingAs($this->activeUser, ['*']);

        $response = $this->getJson('/api/v1/my-tenants');

        $response->assertOk();

        $tenantIds = collect($response->json())->pluck('id')->toArray();
        $this->assertContains($this->tenant->id, $tenantIds);
        $this->assertContains($this->otherTenant->id, $tenantIds);
        $this->assertCount(2, $tenantIds);
    }

    // ── CHANGE PASSWORD ──

    public function test_change_password_with_wrong_current_fails(): void
    {
        Sanctum::actingAs($this->activeUser, ['*']);

        $response = $this->postJson('/api/v1/profile/change-password', [
            'current_password' => 'wrong_password',
            'new_password' => 'newpassword123',
            'new_password_confirmation' => 'newpassword123',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Senha atual incorreta.');
    }

    public function test_change_password_with_valid_data_succeeds(): void
    {
        Sanctum::actingAs($this->activeUser, ['*']);

        $response = $this->postJson('/api/v1/profile/change-password', [
            'current_password' => 'senha1234',
            'new_password' => 'newpassword123',
            'new_password_confirmation' => 'newpassword123',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Senha alterada com sucesso.');

        // Verify new password works
        $this->activeUser->refresh();
        $this->assertTrue(Hash::check('newpassword123', $this->activeUser->password));
    }

    public function test_change_password_revokes_other_sessions(): void
    {
        Sanctum::actingAs($this->activeUser, ['*']);

        // Create extra tokens to simulate multiple sessions
        $this->activeUser->createToken('session-2');
        $this->activeUser->createToken('session-3');
        $this->assertGreaterThanOrEqual(2, $this->activeUser->tokens()->count());

        $this->postJson('/api/v1/profile/change-password', [
            'current_password' => 'senha1234',
            'new_password' => 'newpassword123',
            'new_password_confirmation' => 'newpassword123',
        ])->assertOk();

        // Only current token should remain
        $this->assertEquals(1, $this->activeUser->tokens()->count());
    }
}
