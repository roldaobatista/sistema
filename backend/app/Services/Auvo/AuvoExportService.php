<?php

namespace App\Services\Auvo;

use App\Models\AuvoIdMapping;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Service;
use App\Models\Quote;
use Illuminate\Support\Facades\Log;

class AuvoExportService
{
    private AuvoApiClient $client;

    public function __construct(AuvoApiClient $client)
    {
        $this->client = $client;
    }

    /**
     * Export a Customer to Auvo (Upsert).
     */
    public function exportCustomer(Customer $customer): array
    {
        // Auvo Use "Upsert" logic via PUT.
        // We use our internal ID as externalId to ensure idempotency.
        
        $payload = [
            'externalId' => (string) $customer->id,
            'name' => $customer->name,
            'description' => $customer->trade_name ?? $customer->name,
            'cpfCnpj' => $customer->document,
            'address' => $customer->address_street,
            'addressNumber' => $customer->address_number,
            'complement' => $customer->address_complement,
            'neighborhood' => $customer->address_neighborhood,
            'city' => $customer->address_city,
            'state' => $customer->address_state,
            'zipCode' => $customer->address_zip,
            'email' => $customer->email ? [$customer->email] : [],
            'phoneNumber' => $customer->phone ? [$customer->phone] : [],
            'isActive' => $customer->is_active,
        ];

        // PUT /customers/ performs an Upsert based on externalId (if provided) or ID
        $response = $this->client->put('customers', $payload);

        // Auvo returns the created/updated object in 'result'
        $auvoData = $response['result'] ?? $response;
        $auvoId = $auvoData['id'] ?? null;

        if ($auvoId) {
            AuvoIdMapping::mapOrCreate('customers', (int)$auvoId, $customer->id, $customer->tenant_id);
        }

        return $auvoData;
    }

    /**
     * Export a Product to Auvo.
     */
    public function exportProduct(Product $product): array
    {
        // First check if mapped
        $mapping = AuvoIdMapping::where('entity_type', 'products')
            ->where('local_id', $product->id)
            ->where('tenant_id', $product->tenant_id)
            ->first();

        $payload = [
            'description' => $product->name,
            'name' => $product->name,
            'value' => (float) $product->sell_price,
            'unity' => $product->unit ?? 'UN',
        ];

        if ($mapping) {
            // Update via PATCH (Json Patch format)
            // [ { "op": "replace", "path": "/name", "value": "New Name" } ]
            $patch = [
                ['op' => 'replace', 'path' => '/name', 'value' => $product->name],
                ['op' => 'replace', 'path' => '/description', 'value' => $product->name],
                ['op' => 'replace', 'path' => '/value', 'value' => (float) $product->sell_price],
            ];
            
            $response = $this->client->patch("products/{$mapping->auvo_id}", $patch);
            return $response['result'] ?? $response;
        } else {
            // Create via POST
            $response = $this->client->post('products', $payload);
            $auvoData = $response['result'] ?? $response;
            $auvoId = $auvoData['id'] ?? null;

            if ($auvoId) {
                AuvoIdMapping::mapOrCreate('products', (int)$auvoId, $product->id, $product->tenant_id);
            }
            return $auvoData;
        }
    }

    /**
     * Export a Service to Auvo.
     */
    public function exportService(Service $service): array
    {
         // First check if mapped
         $mapping = AuvoIdMapping::where('entity_type', 'services')
         ->where('local_id', $service->id)
         ->where('tenant_id', $service->tenant_id)
         ->first();

        $payload = [
            'description' => $service->name,
            'name' => $service->name,
            // 'value' => (float) $service->default_price, // Services in Auvo might not have direct value field in easy create, checking docs... usually yes.
        ];

        if ($mapping) {
             // Update via PATCH
             $patch = [
                ['op' => 'replace', 'path' => '/name', 'value' => $service->name],
                ['op' => 'replace', 'path' => '/description', 'value' => $service->name],
            ];
            
            $response = $this->client->patch("services/{$mapping->auvo_id}", $patch);
            return $response['result'] ?? $response;
        } else {
            // Create via POST
            $response = $this->client->post('services', $payload);
            $auvoData = $response['result'] ?? $response;
            $auvoId = $auvoData['id'] ?? null;

            if ($auvoId) {
                AuvoIdMapping::mapOrCreate('services', (int)$auvoId, $service->id, $service->tenant_id);
            }
            return $auvoData;
        }
    }

    /**
     * Export a Quote (Orçamento) as an Auvo Proposal/Quotation.
     * This acts as the "Invoice" or "Venda" export requested.
     */
    public function exportQuote(Quote $quote): array
    {
        $quote->loadMissing('customer', 'items');

        // Resolve Customer Auvo ID
        $customerMapping = AuvoIdMapping::where('entity_type', 'customers')
            ->where('local_id', $quote->customer_id)
            ->where('tenant_id', $quote->tenant_id)
            ->first();

        if (!$customerMapping) {
            $customer = $quote->customer;
            if (!$customer) {
                throw new \RuntimeException('Orçamento sem cliente associado.');
            }
            $auvoCustomer = $this->exportCustomer($customer);
            $customerAuvoId = $auvoCustomer['id'] ?? null;
            if (!$customerAuvoId) {
                throw new \RuntimeException('Falha ao exportar cliente para o Auvo.');
            }
        } else {
            $customerAuvoId = $customerMapping->auvo_id;
        }

        $payload = [
            'customerId' => (int) $customerAuvoId,
            'title' => "Orçamento #{$quote->quote_number} - {$quote->customer->name}",
            'status' => 'Pending',
            'date' => $quote->created_at->format('Y-m-d'),
            'expirationDate' => $quote->valid_until?->format('Y-m-d'),
            'observation' => $quote->observations ?? $quote->internal_notes,
            'totalValue' => (float) $quote->total,
        ];

        $response = $this->client->post('quotations', $payload);
        $auvoData = $response['result'] ?? $response;
        $auvoId = $auvoData['id'] ?? null;

        if ($auvoId) {
            AuvoIdMapping::mapOrCreate('quotations', (int)$auvoId, $quote->id, $quote->tenant_id);
        }

        return $auvoData;
    }
}
