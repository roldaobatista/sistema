<?php

namespace Tests\Unit\Services\Auvo;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Service;
use App\Models\Quote;
use App\Models\AuvoIdMapping;
use App\Services\Auvo\AuvoApiClient;
use App\Services\Auvo\AuvoExportService;
use Tests\TestCase;
use Mockery;

class AuvoExportServiceTest extends TestCase
{

    private $apiClient;
    private $service;
    private $tenantId = 1;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apiClient = Mockery::mock(AuvoApiClient::class);
        $this->service = new AuvoExportService($this->apiClient);
        
        // Create tenant for FK constraints
        $tenant = \App\Models\Tenant::factory()->create();
        $this->tenantId = $tenant->id;
    }

    public function test_export_customer_upsert()
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenantId]);

        $this->apiClient->shouldReceive('put')
            ->once()
            ->with('customers', Mockery::on(function ($payload) use ($customer) {
                return $payload['externalId'] === (string) $customer->id
                    && $payload['name'] === $customer->name;
            }))
            ->andReturn(['result' => ['id' => 12345, 'name' => $customer->name]]);

        $result = $this->service->exportCustomer($customer);

        $this->assertEquals(12345, $result['id']);
        $this->assertDatabaseHas('auvo_id_mappings', [
            'entity_type' => 'customers',
            'local_id' => $customer->id,
            'auvo_id' => 12345
        ]);
    }

    public function test_export_product_create()
    {
        $product = Product::factory()->create(['tenant_id' => $this->tenantId]);

        $this->apiClient->shouldReceive('post')
            ->once()
            ->with('products', Mockery::on(function ($payload) use ($product) {
                return $payload['description'] === $product->name;
            }))
            ->andReturn(['result' => ['id' => 54321]]);

        $result = $this->service->exportProduct($product);

        $this->assertEquals(54321, $result['id']);
        $this->assertDatabaseHas('auvo_id_mappings', [
            'entity_type' => 'products',
            'local_id' => $product->id,
            'auvo_id' => 54321
        ]);
    }

    public function test_export_product_update()
    {
        $product = Product::factory()->create(['tenant_id' => $this->tenantId]);
        AuvoIdMapping::create([
            'entity_type' => 'products',
            'local_id' => $product->id,
            'auvo_id' => 999,
            'tenant_id' => $this->tenantId
        ]);

        $this->apiClient->shouldReceive('patch')
            ->once()
            ->with("products/999", Mockery::type('array'))
            ->andReturn(['result' => ['id' => 999]]);

        $result = $this->service->exportProduct($product);

        $this->assertEquals(999, $result['id']);
    }

    public function test_export_quote_calls_post()
    {
        $quote = Quote::factory()->create(['tenant_id' => $this->tenantId]);
        // Mock customer export inside if needed, or mapping exists
        AuvoIdMapping::create([
            'entity_type' => 'customers',
            'local_id' => $quote->customer_id,
            'auvo_id' => 888,
            'tenant_id' => $this->tenantId
        ]);

        $this->apiClient->shouldReceive('post')
            ->once()
            ->with('quotations', Mockery::on(function ($payload) {
                return $payload['customerId'] === 888;
            }))
            ->andReturn(['result' => ['id' => 777]]);

        $result = $this->service->exportQuote($quote);

        $this->assertEquals(777, $result['id']);
    }
}
