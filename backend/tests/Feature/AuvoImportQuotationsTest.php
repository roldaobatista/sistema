<?php

namespace Tests\Feature;

use App\Models\AuvoIdMapping;
use App\Models\AuvoImport;
use App\Models\Customer;
use App\Models\Quote;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Auvo\AuvoApiClient;
use App\Services\Auvo\AuvoImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuvoImportQuotationsTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;

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
    }

    private function makeService(): AuvoImportService
    {
        return new AuvoImportService(new AuvoApiClient('test-key', 'test-token'));
    }

    private function fakeAuvoWithQuotations(array $quotations = []): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login*' => Http::response([
                'result' => ['accessToken' => 'test-token'],
            ]),
            'api.auvo.com.br/v2/quotations*' => Http::sequence()
                ->push([
                    'result' => [
                        'entityList' => $quotations,
                    ],
                ], 200)
                ->push(['result' => []], 200),
            // Catch-all for SyncsWithCentral etc
            '*' => Http::response([], 200),
        ]);
    }

    public function test_import_quotations_creates_quote_records(): void
    {
        // Pre-create a customer mapping so the quotation can resolve customer_id
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Cliente Teste',
        ]);
        AuvoIdMapping::mapOrCreate('customers', 501, $customer->id, $this->tenant->id);

        $this->fakeAuvoWithQuotations([
            [
                'id' => 1001,
                'title' => 'Manutenção Preventiva',
                'customerId' => 501,
                'status' => 'approved',
                'totalValue' => '1500.00',
                'validUntil' => '2026-03-15',
                'notes' => 'Orçamento importado do Auvo',
            ],
        ]);

        $service = $this->makeService();
        $result = $service->importEntity('quotations', $this->tenant->id, $this->user->id, 'skip');

        $this->assertEquals('done', $result['status']);
        $this->assertGreaterThanOrEqual(1, $result['total_imported']);

        // Quote record should exist
        $quote = Quote::where('tenant_id', $this->tenant->id)->first();
        $this->assertNotNull($quote, 'Quote record should be created');
        $this->assertEquals($customer->id, $quote->customer_id);
        $this->assertEquals('approved', $quote->getRawOriginal('status'));
        $this->assertEquals('1500.00', $quote->total);
        $this->assertEquals('Manutenção Preventiva', $quote->observations);
        $this->assertEquals('Orçamento importado do Auvo', $quote->internal_notes);
        // Quote number should be based on Auvo ID (1001 -> ORC-01001)
        $this->assertEquals('ORC-01001', $quote->quote_number);

        // ID mapping should be saved
        $this->assertDatabaseHas('auvo_id_mappings', [
            'tenant_id' => $this->tenant->id,
            'entity_type' => 'quotations',
            'auvo_id' => '1001',
        ]);
    }

    public function test_import_quotations_uses_fallback_customer(): void
    {
        // Create a fallback customer (no Auvo mapping)
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Fallback Customer',
        ]);

        $this->fakeAuvoWithQuotations([
            [
                'id' => 1002,
                'title' => 'Orçamento Sem Mapeamento',
                'customerId' => 999,
                'status' => 'draft',
                'totalValue' => '800,50',
            ],
        ]);

        $service = $this->makeService();
        $result = $service->importEntity('quotations', $this->tenant->id, $this->user->id, 'skip');

        $this->assertEquals('done', $result['status']);
        $this->assertEquals(1, $result['total_imported']);

        $quote = Quote::where('tenant_id', $this->tenant->id)->first();
        $this->assertNotNull($quote);
        $this->assertEquals($customer->id, $quote->customer_id); // fallback customer
        $this->assertEquals('draft', $quote->getRawOriginal('status'));
        $this->assertEquals('800.50', $quote->total);
    }

    public function test_import_quotations_skips_when_no_customer_exists(): void
    {
        // No customers in tenant at all
        $this->fakeAuvoWithQuotations([
            [
                'id' => 1003,
                'title' => 'Orçamento Sem Nenhum Cliente',
                'status' => 'draft',
            ],
        ]);

        $service = $this->makeService();
        $result = $service->importEntity('quotations', $this->tenant->id, $this->user->id, 'skip');

        $this->assertEquals('done', $result['status']);
        $this->assertEquals(0, $result['total_imported']);
        $this->assertEquals(1, $result['total_skipped']);
    }

    public function test_import_quotations_maps_auvo_statuses(): void
    {
        Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $statusCases = [
            ['id' => 2001, 'status' => 'enviado', 'title' => 'Q1'],
            ['id' => 2002, 'status' => 'rejeitado', 'title' => 'Q2'],
            ['id' => 2003, 'status' => 'expirado', 'title' => 'Q3'],
            ['id' => 2004, 'status' => 'unknown_status', 'title' => 'Q4'],
        ];

        $this->fakeAuvoWithQuotations($statusCases);

        $service = $this->makeService();
        $result = $service->importEntity('quotations', $this->tenant->id, $this->user->id, 'skip');

        $this->assertEquals('done', $result['status']);

        $quotes = Quote::where('tenant_id', $this->tenant->id)->get()->keyBy('observations');

        $this->assertEquals('sent', $quotes['Q1']->getRawOriginal('status'));
        $this->assertEquals('rejected', $quotes['Q2']->getRawOriginal('status'));
        $this->assertEquals('expired', $quotes['Q3']->getRawOriginal('status'));
        $this->assertEquals('draft', $quotes['Q4']->getRawOriginal('status')); // unknown → draft
    }

    public function test_import_quotations_generates_numbers_from_auvo_ids(): void
    {
        Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $this->fakeAuvoWithQuotations([
            ['id' => 3001, 'title' => 'First', 'status' => 'draft'],
            ['id' => 3002, 'title' => 'Second', 'status' => 'draft'],
            ['id' => 3003, 'title' => 'Third', 'status' => 'draft'],
        ]);

        $service = $this->makeService();
        $result = $service->importEntity('quotations', $this->tenant->id, $this->user->id, 'skip');

        $quotes = Quote::where('tenant_id', $this->tenant->id)->orderBy('id')->get();
        $this->assertCount(3, $quotes);

        // Numbers should be based on Auvo IDs
        $numbers = $quotes->pluck('quote_number')->sort()->values();
        $this->assertEquals('ORC-03001', $numbers[0]);
        $this->assertEquals('ORC-03002', $numbers[1]);
        $this->assertEquals('ORC-03003', $numbers[2]);
    }

    public function test_import_quotations_skips_already_mapped(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        // Pre-create a quote and mapping for auvo_id 4001
        $existingQuote = Quote::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'seller_id' => $this->user->id,
            'quote_number' => Quote::nextNumber($this->tenant->id),
            'status' => 'draft',
        ]);
        AuvoIdMapping::mapOrCreate('quotations', 4001, $existingQuote->id, $this->tenant->id);

        $this->fakeAuvoWithQuotations([
            ['id' => 4001, 'title' => 'Already Mapped', 'status' => 'draft'],
            ['id' => 4002, 'title' => 'New One', 'status' => 'draft'],
        ]);

        $service = $this->makeService();
        $result = $service->importEntity('quotations', $this->tenant->id, $this->user->id, 'skip');

        // Only the new one should import
        $this->assertEquals(1, $result['total_imported']);
        $this->assertEquals(1, $result['total_skipped']);
    }

    public function test_import_services_creates_records(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login*' => Http::response([
                'result' => ['accessToken' => 'test-token'],
            ]),
            'api.auvo.com.br/v2/services*' => Http::sequence()
                ->push([
                    'result' => [
                        'entityList' => [
                            [
                                'id' => 5001,
                                'name' => 'Manutenção Corretiva',
                                'code' => 'SVC-001',
                                'description' => 'Serviço de manutenção',
                                'price' => '250,00',
                                'active' => true,
                                'categoryName' => 'Manutenção',
                                'duration' => 60,
                            ],
                        ],
                    ],
                ], 200)
                ->push(['result' => []], 200),
            '*' => Http::response([], 200),
        ]);

        $service = $this->makeService();
        $result = $service->importEntity('services', $this->tenant->id, $this->user->id, 'skip');

        $this->assertEquals('done', $result['status']);
        $this->assertGreaterThanOrEqual(1, $result['total_imported']);

        $this->assertDatabaseHas('services', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Manutenção Corretiva',
            'code' => 'SVC-001',
            'is_active' => true,
            'estimated_minutes' => 60,
        ]);

        // Category should be auto-created
        $this->assertDatabaseHas('service_categories', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Manutenção',
        ]);

        $this->assertDatabaseHas('auvo_id_mappings', [
            'tenant_id' => $this->tenant->id,
            'entity_type' => 'services',
            'auvo_id' => '5001',
        ]);
    }
}
