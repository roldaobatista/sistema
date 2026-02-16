<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Service;
use App\Models\Quote;
use App\Services\Auvo\AuvoApiClient;
use App\Services\Auvo\AuvoExportService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AuvoExportController extends Controller
{
    private function exportService(Request $request): AuvoExportService
    {
        $client = AuvoApiClient::forTenant($request->user()->current_tenant_id);

        if (!$client->hasCredentials()) {
            throw new \RuntimeException('Credenciais Auvo não configuradas. Configure em Integração > Auvo.');
        }

        return new AuvoExportService($client);
    }

    public function exportCustomer(Request $request, Customer $customer): JsonResponse
    {
        try {
            $result = $this->exportService($request)->exportCustomer($customer);
            return response()->json([
                'message' => 'Cliente exportado com sucesso para o Auvo.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao exportar cliente: ' . $e->getMessage()], 500);
        }
    }

    public function exportProduct(Request $request, Product $product): JsonResponse
    {
        try {
            $result = $this->exportService($request)->exportProduct($product);
            return response()->json([
                'message' => 'Produto exportado com sucesso para o Auvo.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao exportar produto: ' . $e->getMessage()], 500);
        }
    }

    public function exportServiceEntity(Request $request, Service $service): JsonResponse
    {
        try {
            $result = $this->exportService($request)->exportService($service);
            return response()->json([
                'message' => 'Serviço exportado com sucesso para o Auvo.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao exportar serviço: ' . $e->getMessage()], 500);
        }
    }

    public function exportQuote(Request $request, Quote $quote): JsonResponse
    {
        try {
            $result = $this->exportService($request)->exportQuote($quote);
            return response()->json([
                'message' => 'Orçamento exportado com sucesso para o Auvo.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao exportar orçamento: ' . $e->getMessage()], 500);
        }
    }
}
