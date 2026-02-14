<?php

namespace Tests\Feature;

use App\Models\AuvoIdMapping;
use App\Models\AuvoImport;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Auvo\AuvoApiClient;
use App\Services\Auvo\AuvoImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuvoImportServiceTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private AuvoImportService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);

        $this->fakeAuvoAuth();
    }

    private function fakeAuvoAuth(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response([
                'result' => ['accessToken' => 'test-token'],
            ]),
        ]);
    }

    private function makeService(): AuvoImportService
    {
        return new AuvoImportService(new AuvoApiClient('test-key', 'test-token'));
    }

    // ── Preview ──

    public function test_preview_returns_sample_data(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::response([
                'result' => [
                    'entityList' => [
                        ['id' => 1, 'name' => 'Empresa Teste', 'description' => 'Empresa Teste'],
                        ['id' => 2, 'name' => 'Outra Empresa', 'description' => 'Outra Empresa'],
                    ],
                ],
            ]),
        ]);

        $service = $this->makeService();
        $preview = $service->preview('customers', 5);

        $this->assertEquals('customers', $preview['entity']);
        $this->assertGreaterThanOrEqual(1, $preview['total']);
        $this->assertNotEmpty($preview['sample']);
        $this->assertNotEmpty($preview['mapped_fields']);
    }

    // ── Import Entity ──

    public function test_import_customers_creates_records(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::sequence()
                ->push([
                    'result' => [
                        'entityList' => [
                            [
                                'id' => 101,
                                'description' => 'Padaria Bom Sabor',
                                'cpfCnpj' => '12.345.678/0001-90',
                                'email' => ['contato@padaria.com'], // Auvo returns array
                                'phone' => ['11999887766'],         // Auvo returns array
                                'address' => 'Rua A',
                                'addressNumber' => '123',
                                'neighborhood' => 'Centro',
                                'city' => 'São Paulo',
                                'state' => 'SP',
                                'zipCode' => '01001-000',
                            ],
                        ],
                    ],
                ], 200)
                ->push(['result' => []], 200), // Empty page 2
        ]);

        $service = $this->makeService();
        $result = $service->importEntity('customers', $this->tenant->id, $this->user->id, 'skip');

        $this->assertGreaterThanOrEqual(1, $result['inserted']);
        $this->assertEquals('completed', $result['status']);

        $this->assertDatabaseHas('customers', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Padaria Bom Sabor',
        ]);

        // Should have created an ID mapping
        $this->assertDatabaseHas('auvo_id_mappings', [
            'tenant_id' => $this->tenant->id,
            'entity_type' => 'customers',
            'auvo_id' => '101',
        ]);
    }

    public function test_import_customers_skips_duplicates(): void
    {
        // Pre-existing customer with the same document
        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'document' => '12345678000190',
            'name' => 'Existing Customer',
        ]);

        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::sequence()
                ->push([
                    'result' => [
                        'entityList' => [
                            [
                                'id' => 201,
                                'description' => 'Duplicate Customer',
                                'cpfCnpj' => '12.345.678/0001-90',
                                'email' => ['dup@test.com'],
                            ],
                        ],
                    ],
                ], 200)
                ->push(['result' => []], 200),
        ]);

        $service = $this->makeService();
        $result = $service->importEntity('customers', $this->tenant->id, $this->user->id, 'skip');

        $this->assertEquals(0, $result['inserted']);
        $this->assertEquals(1, $result['skipped']);

        // Original name should be preserved
        $this->assertDatabaseHas('customers', [
            'tenant_id' => $this->tenant->id,
            'document' => '12345678000190',
            'name' => 'Existing Customer',
        ]);
    }

    public function test_import_customers_updates_duplicates_when_strategy_is_update(): void
    {
        $existing = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'document' => '12345678000190',
            'name' => 'Old Name',
        ]);

        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::sequence()
                ->push([
                    'result' => [
                        'entityList' => [
                            [
                                'id' => 301,
                                'description' => 'Updated Name',
                                'cpfCnpj' => '12.345.678/0001-90',
                                'email' => ['updated@test.com'],
                            ],
                        ],
                    ],
                ], 200)
                ->push(['result' => []], 200),
        ]);

        $service = $this->makeService();
        $result = $service->importEntity('customers', $this->tenant->id, $this->user->id, 'update');

        $this->assertEquals(1, $result['updated']);
        $this->assertEquals(0, $result['inserted']);

        $existing->refresh();
        $this->assertEquals('Updated Name', $existing->name);
    }

    // ── Import Creates AuvoImport Record ──

    public function test_import_creates_auvo_import_record(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::sequence()
                ->push(['result' => []], 200), // Empty results
        ]);

        $service = $this->makeService();
        $service->importEntity('customers', $this->tenant->id, $this->user->id, 'skip');

        $this->assertDatabaseHas('auvo_imports', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => 'customers',
            'status' => 'done',
        ]);
    }

    // ── Rollback ──

    public function test_rollback_deletes_imported_records_and_mappings(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $import = AuvoImport::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => 'customers',
            'status' => 'done',
            'total_fetched' => 1,
            'total_imported' => 1,
            'imported_ids' => [$customer->id],
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        AuvoIdMapping::create([
            'tenant_id' => $this->tenant->id,
            'entity_type' => 'customers',
            'auvo_id' => '999',
            'kalibrium_id' => $customer->id,
            'import_id' => $import->id,
        ]);

        $service = $this->makeService();
        $result = $service->rollback($import);

        $this->assertEquals(1, $result['deleted']);
        $this->assertEquals('rolled_back', $result['status']);

        // Customer soft-deleted
        $this->assertSoftDeleted('customers', ['id' => $customer->id]);

        // Mappings removed
        $this->assertDatabaseMissing('auvo_id_mappings', [
            'import_id' => $import->id,
        ]);

        // Import record updated
        $import->refresh();
        $this->assertEquals('rolled_back', $import->status);
    }

    public function test_rollback_rejects_non_completed_import(): void
    {
        $import = AuvoImport::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => 'customers',
            'status' => 'failed',
            'total_fetched' => 0,
            'total_imported' => 0,
            'started_at' => now(),
        ]);

        $service = $this->makeService();

        $this->expectException(\RuntimeException::class);
        $service->rollback($import);
    }

    // ── Import All ──

    public function test_import_all_processes_entities_in_order(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/*' => Http::response(['result' => []], 200), // Empty for all
        ]);

        $service = $this->makeService();
        $results = $service->importAll($this->tenant->id, $this->user->id, 'skip');

        // Should have processed multiple entities
        $this->assertIsArray($results);
        $this->assertNotEmpty($results);

        // All should be completed or skipped
        foreach ($results as $entity => $result) {
            $this->assertContains($result['status'], ['completed', 'failed', 'skipped'], "Entity {$entity} has unexpected status");
        }
    }

    // ── Invalid Entity ──

    public function test_import_entity_rejects_invalid_entity(): void
    {
        $service = $this->makeService();

        $this->expectException(\InvalidArgumentException::class);
        $service->importEntity('nonexistent', $this->tenant->id, $this->user->id);
    }
}
