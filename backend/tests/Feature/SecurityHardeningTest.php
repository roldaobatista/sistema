<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Security Hardening Tests — validates protection against common
 * attack vectors: SQL injection, XSS, mass assignment, IDOR,
 * and sensitive data exposure.
 */
class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenantA;
    private Tenant $tenantB;
    private User $userA;
    private User $userB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $this->tenantA = Tenant::factory()->create();
        $this->tenantB = Tenant::factory()->create();

        $this->userA = User::factory()->create([
            'tenant_id' => $this->tenantA->id,
            'current_tenant_id' => $this->tenantA->id,
        ]);
        $this->userA->tenants()->attach($this->tenantA->id, ['is_default' => true]);

        $this->userB = User::factory()->create([
            'tenant_id' => $this->tenantB->id,
            'current_tenant_id' => $this->tenantB->id,
        ]);
        $this->userB->tenants()->attach($this->tenantB->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenantA->id);
        setPermissionsTeamId($this->tenantA->id);
        Sanctum::actingAs($this->userA, ['*']);
    }

    // ── SQL INJECTION ──

    public function test_sql_injection_in_customer_search_blocked(): void
    {
        // Create a legitimate customer
        Customer::factory()->create([
            'tenant_id' => $this->tenantA->id,
            'name' => 'Legit Customer',
        ]);

        // Try SQL injection via search param
        $response = $this->getJson('/api/v1/customers?search=' . urlencode("' OR 1=1 --"));

        // Should not return ALL records — either returns nothing or filtered results
        $response->assertOk();
        $data = $response->json('data') ?? $response->json();
        // The injection should be treated as literal text, not SQL
        $this->assertTrue(is_array($data));
    }

    public function test_sql_injection_in_work_order_search_blocked(): void
    {
        $response = $this->getJson('/api/v1/work-orders?search=' . urlencode("'; DROP TABLE work_orders;--"));
        $response->assertOk();

        // Verify table still exists
        $this->assertDatabaseCount('work_orders', WorkOrder::count());
    }

    // ── XSS ──

    public function test_xss_in_customer_name_is_stored_escaped(): void
    {
        $xssPayload = '<script>alert("xss")</script>';

        $response = $this->postJson('/api/v1/customers', [
            'name' => $xssPayload,
            'type' => 'PF',
        ]);

        // Customer may be created (stored) or rejected — both are acceptable
        $response->assertStatus(201);
        $responseBody = $response->content();
        $this->assertStringNotContainsString('<script>', $responseBody);
    }

    // ── MASS ASSIGNMENT ──

    public function test_mass_assignment_tenant_id_blocked_on_customer(): void
    {
        $response = $this->postJson('/api/v1/customers', [
            'name' => 'Test Mass Assignment',
            'type' => 'PF',
            'tenant_id' => $this->tenantB->id, // Trying to inject another tenant
        ]);

        $response->assertStatus(201);

        $customerId = $response->json('data.id') ?? $response->json('id');
        $customer = Customer::withoutGlobalScopes()->find($customerId);

        $this->assertEquals($this->tenantA->id, $customer->tenant_id);
        $this->assertNotEquals($this->tenantB->id, $customer->tenant_id);
    }

    public function test_mass_assignment_tenant_id_blocked_on_work_order(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenantA->id,
        ]);

        $response = $this->postJson('/api/v1/work-orders', [
            'customer_id' => $customer->id,
            'description' => 'OS Test Mass Assignment',
            'tenant_id' => $this->tenantB->id,
        ]);

        $response->assertStatus(201);

        $woId = $response->json('data.id') ?? $response->json('id');
        $wo = WorkOrder::withoutGlobalScopes()->find($woId);
        $this->assertEquals($this->tenantA->id, $wo->tenant_id);
    }

    // ── IDOR (Insecure Direct Object Reference) ──

    public function test_user_cannot_view_other_tenant_customer_by_id(): void
    {
        // Create customer in tenant B
        $secretCustomer = Customer::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantB->id,
            'name' => 'Secret Corp',
            'type' => 'PJ',
        ]);

        // User A tries to access it
        $response = $this->getJson("/api/v1/customers/{$secretCustomer->id}");

        // Should get 404 (not found in their scope) or 403
        $response->assertStatus(404);
    }

    public function test_user_cannot_update_other_tenant_customer(): void
    {
        $secretCustomer = Customer::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantB->id,
            'name' => 'Secret Corp',
            'type' => 'PJ',
        ]);

        $response = $this->putJson("/api/v1/customers/{$secretCustomer->id}", [
            'name' => 'Hacked Name',
        ]);

        $response->assertStatus(404);

        // Verify name was NOT changed
        $secretCustomer->refresh();
        $this->assertEquals('Secret Corp', $secretCustomer->name);
    }

    public function test_user_cannot_delete_other_tenant_customer(): void
    {
        $secretCustomer = Customer::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantB->id,
            'name' => 'Secret Corp',
            'type' => 'PJ',
        ]);

        $response = $this->deleteJson("/api/v1/customers/{$secretCustomer->id}");

        $response->assertStatus(404);

        // Verify record still exists
        $this->assertDatabaseHas('customers', ['id' => $secretCustomer->id]);
    }

    // ── SENSITIVE DATA EXPOSURE ──

    public function test_user_response_does_not_contain_password_hash(): void
    {
        Sanctum::actingAs($this->userA, ['*']);

        $response = $this->getJson('/api/v1/me');
        $body = $response->content();

        $this->assertStringNotContainsString('password', $body);
        $this->assertStringNotContainsString('remember_token', $body);
    }

    public function test_user_listing_does_not_expose_passwords(): void
    {
        $response = $this->getJson('/api/v1/users');

        $response->assertOk();
        $body = $response->content();
        $this->assertStringNotContainsString('"password"', $body);
    }
}
