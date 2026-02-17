<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StockMovement;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProductKardexController extends Controller
{
    public function index(Request $request, Product $product): JsonResponse
    {
        try {
            $tenantId = app()->bound('current_tenant_id') ? (int) app('current_tenant_id') : null;

            if (!$tenantId) {
                return response()->json(['message' => 'Tenant não identificado'], 403);
            }

            if ($product->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Produto não pertence ao tenant atual'], 403);
            }

            $query = StockMovement::where('product_id', $product->id)
                ->where('tenant_id', $tenantId)
                ->with(['user:id,name', 'warehouse:id,name']);

            if ($request->filled('warehouse_id')) {
                $query->where('warehouse_id', $request->input('warehouse_id'));
            }

            if ($request->filled('type')) {
                $query->where('type', $request->input('type'));
            }

            if ($request->filled('from')) {
                $query->where('created_at', '>=', $request->input('from'));
            }

            if ($request->filled('to')) {
                $query->where('created_at', '<=', $request->input('to') . ' 23:59:59');
            }

            $perPage = min((int) $request->input('per_page', 50), 200);

            $movements = $query->orderByDesc('created_at')->paginate($perPage);

            $stats = StockMovement::where('product_id', $product->id)
                ->where('tenant_id', $tenantId)
                ->selectRaw("
                    SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_in,
                    SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_out,
                    COUNT(*) as total_movements,
                    MIN(created_at) as first_movement,
                    MAX(created_at) as last_movement
                ")
                ->first();

            return response()->json([
                'product' => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'code' => $product->code,
                    'current_stock' => $product->stock_qty ?? 0,
                ],
                'stats' => $stats,
                'data' => $movements,
            ]);
        } catch (\Exception $e) {
            Log::error('ProductKardex index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar kardex do produto'], 500);
        }
    }

    public function monthlySummary(Request $request, Product $product): JsonResponse
    {
        try {
            $tenantId = app()->bound('current_tenant_id') ? (int) app('current_tenant_id') : null;

            if (!$tenantId) {
                return response()->json(['message' => 'Tenant não identificado'], 403);
            }

            if ($product->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Produto não pertence ao tenant atual'], 403);
            }

            $months = min((int) $request->input('months', 12), 24);

            $results = StockMovement::where('product_id', $product->id)
                ->where('tenant_id', $tenantId)
                ->where('created_at', '>=', now()->subMonths($months))
                ->selectRaw("
                    DATE_FORMAT(created_at, '%Y-%m') as month,
                    SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as entries,
                    SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as exits,
                    COUNT(*) as movements
                ")
                ->groupBy('month')
                ->orderBy('month')
                ->get();

            return response()->json(['data' => $results]);
        } catch (\Exception $e) {
            Log::error('ProductKardex monthlySummary failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar resumo mensal'], 500);
        }
    }
}
