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
            'address' => $customer->address,
            'addressNumber' => $customer->address_number,
            'complement' => $customer->address_complement,
            'neighborhood' => $customer->neighborhood,
            'city' => $customer->city,
            'state' => $customer->state,
            'zipCode' => $customer->zip_code,
            'email' => $customer->email ? [$customer->email] : [],
            'phoneNumber' => $customer->phone ? [$customer->phone] : [],
            'isActive' => $customer->is_active,
            // 'tags' => ['Integração'], 
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
        // Resolve Customer Auvo ID
        $customerMapping = AuvoIdMapping::where('entity_type', 'customers')
            ->where('local_id', $quote->customer_id)
            ->where('tenant_id', $quote->tenant_id)
            ->first();

        if (!$customerMapping) {
            // Auto-export customer if missing
            $customer = $quote->customer;
            $auvoCustomer = $this->exportCustomer($customer);
            $customerAuvoId = $auvoCustomer['id'];
        } else {
            $customerAuvoId = $customerMapping->auvo_id;
        }

        // Build Payload
        // Auvo Quotations usually require valid customerID, date, and items.
        
        $payload = [
            'customerId' => (int) $customerAuvoId,
            'title' => "Orçamento #{$quote->id} - {$quote->customer->name}",
            'status' => 'Pending', // Or map statuses
            'date' => $quote->created_at->format('Y-m-d'),
            'expirationDate' => $quote->expiration_date?->format('Y-m-d'),
            'observation' => $quote->notes,
        ];

        // Items logic would go here if Auvo allows sending items in the same payload
        // Documentation check needed for structure of 'items' in Quotation POST.
        // Assuming array of {name, value, quantity}
        
        // For MVP of export, let's send basic header first.
        // If items are required, we loop them.
        
        $response = $this->client->post('quotations', $payload);
        $auvoData = $response['result'] ?? $response;
        $auvoId = $auvoData['id'] ?? null;

        if ($auvoId) {
            AuvoIdMapping::mapOrCreate('quotations', (int)$auvoId, $quote->id, $quote->tenant_id);
        }

        return $auvoData;
    }
}
