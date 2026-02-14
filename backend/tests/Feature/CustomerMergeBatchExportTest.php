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
 * Customer Merge & Batch Export Tests — validates customer deduplication,
 * merge functionality, batch CSV export, and price history endpoints.
 */
class CustomerMergeBatchExportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;

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
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── CUSTOMER MERGE ──

    public function test_search_duplicates_by_name(): void
    {
        // Create two customers with same name
        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Duplicado Teste',
        ]);
        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Duplicado Teste',
        ]);

        $response = $this->getJson('/api/v1/customers/search-duplicates?type=name');
        $response->assertOk();

        $data = $response->json();
        $this->assertIsArray($data);
    }

    public function test_search_duplicates_by_document(): void
    {
        $response = $this->getJson('/api/v1/customers/search-duplicates?type=document');
        $response->assertOk();
    }

    public function test_merge_customers_transfers_relationships(): void
    {
        $primary = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $duplicate = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        // Create a WO on the duplicate
        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $duplicate->id,
        ]);

        $response = $this->postJson('/api/v1/customers/merge', [
            'primary_id' => $primary->id,
            'duplicate_ids' => [$duplicate->id],
        ]);

        $response->assertOk();

        // Duplicate should be soft-deleted
        $this->assertSoftDeleted('customers', ['id' => $duplicate->id]);

        // WO should now belong to primary
        $wo = WorkOrder::where('customer_id', $primary->id)->first();
        $this->assertNotNull($wo);
    }

    public function test_merge_rejects_same_primary_and_duplicate(): void
    {
        $response = $this->postJson('/api/v1/customers/merge', [
            'primary_id' => $this->customer->id,
            'duplicate_ids' => [$this->customer->id],
        ]);

        $response->assertStatus(422);
    }

    // ── BATCH EXPORT ──

    public function test_batch_export_entities_lists_available(): void
    {
        $response = $this->getJson('/api/v1/batch-export/entities');
        $response->assertOk();

        $data = $response->json('data');
        $this->assertIsArray($data);
        $this->assertGreaterThanOrEqual(1, count($data));

        // Each entity should have key, label, fields, count
        $entity = $data[0];
        $this->assertArrayHasKey('key', $entity);
        $this->assertArrayHasKey('label', $entity);
        $this->assertArrayHasKey('fields', $entity);
        $this->assertArrayHasKey('count', $entity);
    }

    public function test_batch_export_csv_for_customers(): void
    {
        $response = $this->postJson('/api/v1/batch-export/csv', [
            'entity' => 'customers',
        ]);

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
    }

    public function test_batch_export_csv_validates_entity(): void
    {
        $response = $this->postJson('/api/v1/batch-export/csv', [
            'entity' => 'invalid_entity',
        ]);

        $response->assertStatus(422);
    }

    public function test_batch_print_validates_entity_and_ids(): void
    {
        $response = $this->postJson('/api/v1/batch-export/print', [
            'entity' => 'work_orders',
            'ids' => [1, 2, 3],
        ]);

        $response->assertOk();
        $this->assertEquals('work_orders', $response->json('entity'));
    }

    // ── PRICE HISTORY ──

    public function test_price_history_index(): void
    {
        $response = $this->getJson('/api/v1/price-history');
        $response->assertOk();
    }

    public function test_price_history_with_date_filter(): void
    {
        $response = $this->getJson('/api/v1/price-history?date_from=2025-01-01&date_to=2025-12-31');
        $response->assertOk();
    }
}
