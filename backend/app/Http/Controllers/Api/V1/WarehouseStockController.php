<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WarehouseStock;
use App\Models\Warehouse;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WarehouseStockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $tenantId = app('current_tenant_id');
            $query = WarehouseStock::with(['warehouse', 'product', 'batch'])
                ->whereHas('warehouse', fn ($q) => $q->where('tenant_id', $tenantId));

            if ($request->filled('warehouse_id')) {
                $query->where('warehouse_id', $request->warehouse_id);
            }

            if ($request->filled('product_id')) {
                $query->where('product_id', $request->product_id);
            }

            if ($request->filled('batch_id')) {
                $query->where('batch_id', $request->batch_id);
            }

            if ($request->boolean('hide_empty', true)) {
                $query->where('quantity', '>', 0);
            }

            $stocks = $query->paginate($request->integer('per_page', 50));

            return response()->json($stocks);
        } catch (\Exception $e) {
            Log::error('WarehouseStock index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar estoque'], 500);
        }
    }

    public function byWarehouse(Request $request, Warehouse $warehouse): JsonResponse
    {
        try {
            $tenantId = app('current_tenant_id');
            if ($warehouse->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Armazém não encontrado'], 404);
            }

            $stocks = WarehouseStock::where('warehouse_id', $warehouse->id)
                ->with(['product:id,name,code,unit', 'batch'])
                ->where('quantity', '>', 0)
                ->get();

            return response()->json([
                'warehouse' => $warehouse,
                'data' => $stocks
            ]);
        } catch (\Exception $e) {
            Log::error('WarehouseStock byWarehouse failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar estoque por armazém'], 500);
        }
    }

    public function byProduct(Request $request, Product $product): JsonResponse
    {
        try {
            $tenantId = app('current_tenant_id');
            if ($product->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Produto não encontrado'], 404);
            }

            $stocks = WarehouseStock::where('product_id', $product->id)
                ->whereHas('warehouse', fn ($q) => $q->where('tenant_id', $tenantId))
                ->with(['warehouse:id,name,type', 'batch'])
                ->where('quantity', '>', 0)
                ->get();

            return response()->json([
                'product' => $product,
                'data' => $stocks
            ]);
        } catch (\Exception $e) {
            Log::error('WarehouseStock byProduct failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar estoque por produto'], 500);
        }
    }
}
