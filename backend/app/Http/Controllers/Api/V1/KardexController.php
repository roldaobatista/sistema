<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Warehouse;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class KardexController extends Controller
{
    public function __construct(protected StockService $stockService) {}

    public function show(Request $request, Product $product): JsonResponse
    {
        try {
            $tenantId = app('current_tenant_id');
            if ($product->tenant_id !== $tenantId) abort(403);

            $validated = $request->validate([
                'warehouse_id' => "required|exists:warehouses,id,tenant_id,{$tenantId}",
                'date_from' => 'nullable|date',
                'date_to' => 'nullable|date',
            ]);

            $kardex = $this->stockService->getKardex(
                productId: $product->id,
                warehouseId: $validated['warehouse_id'],
                dateFrom: $validated['date_from'] ?? null,
                dateTo: $validated['date_to'] ?? null
            );

            return response()->json([
                'product' => $product->only(['id', 'name', 'sku']),
                'warehouse' => Warehouse::find($validated['warehouse_id'])->only(['id', 'name']),
                'data' => $kardex
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => 'Sem permissão'], 403);
        } catch (\Exception $e) {
            Log::error('Kardex show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar kardex'], 500);
        }
    }
}
