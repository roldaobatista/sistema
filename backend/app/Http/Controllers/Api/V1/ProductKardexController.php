<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StockMovement;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductKardexController extends Controller
{
    /**
     * GET /products/{product}/kardex
     * Full movement history (Kardex) for a product.
     */
    public function index(Request $request, Product $product): JsonResponse
    {
        $tenantId = app()->bound('current_tenant_id') ? (int) app('current_tenant_id') : null;

        $query = StockMovement::where('product_id', $product->id)
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
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

        // Calculate running balance
        $movements = $query->orderBydesc('created_at')->paginate($perPage);

        // Summary stats
        $stats = StockMovement::where('product_id', $product->id)
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
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
                'current_stock' => $product->current_stock ?? 0,
            ],
            'stats' => $stats,
            'data' => $movements,
        ]);
    }

    /**
     * GET /products/{product}/kardex/summary
     * Monthly summary of movements.
     */
    public function monthlySummary(Request $request, Product $product): JsonResponse
    {
        $tenantId = app()->bound('current_tenant_id') ? (int) app('current_tenant_id') : null;
        $months = min((int) $request->input('months', 12), 24);

        $results = StockMovement::where('product_id', $product->id)
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->where('created_at', '>=', now()->subMonths($months))
            ->selectRaw("
                strftime('%Y-%m', created_at) as month,
                SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as entries,
                SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as exits,
                COUNT(*) as movements
            ")
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return response()->json(['data' => $results]);
    }
}
