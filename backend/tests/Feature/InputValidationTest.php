<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Input Validation Tests — validates that the API properly rejects
 * invalid input with 422 errors and returns structured field errors.
 */
class InputValidationTest extends TestCase
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

    // ── CUSTOMER VALIDATION ──

    public function test_create_customer_requires_name(): void
    {
        $response = $this->postJson('/api/v1/customers', [
            'type' => 'PF',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('name');
    }

    public function test_create_customer_requires_type(): void
    {
        $response = $this->postJson('/api/v1/customers', [
            'name' => 'Test Customer',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('type');
    }

    public function test_create_customer_rejects_invalid_type(): void
    {
        $response = $this->postJson('/api/v1/customers', [
            'name' => 'Test',
            'type' => 'INVALID',
        ]);

        $response->assertStatus(422);
    }

    public function test_create_customer_rejects_invalid_email(): void
    {
        $response = $this->postJson('/api/v1/customers', [
            'name' => 'Test',
            'type' => 'PF',
            'email' => 'not-an-email',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('email');
    }

    // ── WORK ORDER VALIDATION ──

    public function test_create_work_order_requires_customer_id(): void
    {
        $response = $this->postJson('/api/v1/work-orders', [
            'description' => 'Test WO',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('customer_id');
    }

    public function test_create_work_order_rejects_nonexistent_customer(): void
    {
        $response = $this->postJson('/api/v1/work-orders', [
            'customer_id' => 99999,
            'description' => 'Test WO',
        ]);

        $response->assertStatus(422);
    }

    public function test_create_work_order_rejects_invalid_priority(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->postJson('/api/v1/work-orders', [
            'customer_id' => $customer->id,
            'priority' => 'SUPER_HIGH',
        ]);

        $response->assertStatus(422);
    }

    // ── USER VALIDATION ──

    public function test_create_user_requires_name_and_email(): void
    {
        $response = $this->postJson('/api/v1/users', [
            'password' => 'senha1234',
        ]);

        $response->assertStatus(422);
    }

    public function test_create_user_rejects_weak_password(): void
    {
        $response = $this->postJson('/api/v1/users', [
            'name' => 'Test User',
            'email' => 'test@test.com',
            'password' => '123', // too short
        ]);

        $response->assertStatus(422);
    }

    public function test_create_user_rejects_duplicate_email(): void
    {
        $response = $this->postJson('/api/v1/users', [
            'name' => 'Test User',
            'email' => $this->user->email, // already exists
            'password' => 'senhasegura123',
        ]);

        $response->assertStatus(422);
    }

    // ── INVOICE VALIDATION ──

    public function test_create_invoice_validates_required_fields(): void
    {
        $response = $this->postJson('/api/v1/invoices', []);

        // Should require at least customer_id or work_order_id
        $response->assertStatus(422);
    }

    // ── ACCOUNT RECEIVABLE VALIDATION ──

    public function test_create_receivable_requires_amount(): void
    {
        $response = $this->postJson('/api/v1/accounts-receivable', [
            'description' => 'Test',
        ]);

        $response->assertStatus(422);
    }

    public function test_create_receivable_rejects_negative_amount(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->postJson('/api/v1/accounts-receivable', [
            'customer_id' => $customer->id,
            'description' => 'Test',
            'amount' => -100,
            'due_date' => now()->addDays(30)->format('Y-m-d'),
        ]);

        $response->assertStatus(422);
    }

    // ── EQUIPMENT VALIDATION ──

    public function test_create_equipment_validates_serial_number(): void
    {
        $response = $this->postJson('/api/v1/equipments', [
            'brand' => 'Toledo',
        ]);

        $response->assertStatus(422);
    }

    // ── QUOTE VALIDATION ──

    public function test_create_quote_requires_customer(): void
    {
        $response = $this->postJson('/api/v1/quotes', [
            'title' => 'Test Quote',
        ]);

        $response->assertStatus(422);
    }

    // ── EDGE CASES ──

    public function test_empty_request_body_returns_422(): void
    {
        $response = $this->postJson('/api/v1/customers', []);
        $response->assertStatus(422);
    }

    public function test_extremely_long_string_is_rejected(): void
    {
        $response = $this->postJson('/api/v1/customers', [
            'name' => str_repeat('A', 10000),
            'type' => 'PF',
        ]);

        $response->assertStatus(422);
    }

    public function test_json_with_nested_xss_in_field(): void
    {
        $response = $this->postJson('/api/v1/customers', [
            'name' => 'Test<img src=x onerror=alert(1)>',
            'type' => 'PF',
        ]);

        $response->assertCreated();
        $this->assertStringNotContainsString('onerror', $response->json('data.name') ?? '');
    }
}
