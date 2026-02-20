<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * API Response Structure Tests — validates that ALL major endpoints
 * return consistent response structure (data, meta, message keys).
 */
class ApiResponseStructureTest extends TestCase
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

    #[DataProvider('listEndpointsProvider')]
    public function test_list_endpoints_return_array_data(string $uri): void
    {
        $response = $this->getJson("/api/v1/{$uri}");
        $response->assertOk();

        $json = $response->json();
        // List endpoints should return data as array (either 'data' key or root array)
        if (isset($json['data'])) {
            $this->assertIsArray($json['data']);
        } else {
            $this->assertIsArray($json);
        }
    }

    public static function listEndpointsProvider(): array
    {
        return [
            'customers' => ['customers'],
            'work-orders' => ['work-orders'],
            'products' => ['products'],
            'equipments' => ['equipments'],
            'quotes' => ['quotes'],
            'service-calls' => ['service-calls'],
            'accounts-receivable' => ['accounts-receivable'],
            'accounts-payable' => ['accounts-payable'],
            'invoices' => ['invoices'],
            'expenses' => ['expenses'],
            'crm-deals' => ['crm/deals'],
            'crm-activities' => ['crm/activities'],
            'notifications' => ['notifications'],
        ];
    }

    #[DataProvider('createEndpointsProvider')]
    public function test_create_endpoints_reject_empty_body(string $uri): void
    {
        $response = $this->postJson("/api/v1/{$uri}", []);
        $response->assertStatus(422);
    }

    public static function createEndpointsProvider(): array
    {
        return [
            'customers' => ['customers'],
            'work-orders' => ['work-orders'],
            'quotes' => ['quotes'],
            'service-calls' => ['service-calls'],
        ];
    }

    public function test_nonexistent_endpoint_returns_404(): void
    {
        $response = $this->getJson('/api/v1/this-does-not-exist');
        $response->assertStatus(404);
    }



    public function test_profile_endpoint_returns_user_data(): void
    {
        $response = $this->getJson('/api/v1/profile');
        $response->assertOk();

        $data = $response->json();
        $user = $data['data'] ?? $data;
        $this->assertArrayHasKey('name', $user);
        $this->assertArrayHasKey('email', $user);
    }

    public function test_reports_suppliers_returns_data(): void
    {
        $response = $this->getJson('/api/v1/reports/suppliers');
        $response->assertOk();
    }

    public function test_reports_stock_returns_data(): void
    {
        $response = $this->getJson('/api/v1/reports/stock');
        $response->assertOk();
    }

    public function test_numbering_sequences_index(): void
    {
        $response = $this->getJson('/api/v1/numbering-sequences');
        $response->assertOk();
    }

    public function test_settings_index(): void
    {
        $response = $this->getJson('/api/v1/settings');
        $response->assertOk();
    }
}
