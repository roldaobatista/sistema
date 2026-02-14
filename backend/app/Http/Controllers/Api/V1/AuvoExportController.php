<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Service;
use App\Models\Quote;
use App\Services\Auvo\AuvoExportService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AuvoExportController extends Controller
{
    private AuvoExportService $service;

    public function __construct(AuvoExportService $service)
    {
        $this->service = $service;
    }

    public function exportCustomer(Request $request, Customer $customer): JsonResponse
    {
        try {
            $result = $this->service->exportCustomer($customer);
            return response()->json([
                'message' => 'Cliente exportado com sucesso para o Auvo.',
                'data' => $result
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao exportar cliente: ' . $e->getMessage()], 500);
        }
    }

    public function exportProduct(Request $request, Product $product): JsonResponse
    {
        try {
            $result = $this->service->exportProduct($product);
            return response()->json([
                'message' => 'Produto exportado com sucesso para o Auvo.',
                'data' => $result
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao exportar produto: ' . $e->getMessage()], 500);
        }
    }

    public function exportService(Request $request, Service $service): JsonResponse
    {
        try {
            $result = $this->service->exportService($service);
            return response()->json([
                'message' => 'Serviço exportado com sucesso para o Auvo.',
                'data' => $result
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao exportar serviço: ' . $e->getMessage()], 500);
        }
    }

    public function exportQuote(Request $request, Quote $quote): JsonResponse
    {
        try {
            $result = $this->service->exportQuote($quote);
            return response()->json([
                'message' => 'Orçamento exportado com sucesso para o Auvo.',
                'data' => $result
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao exportar orçamento: ' . $e->getMessage()], 500);
        }
    }
}
