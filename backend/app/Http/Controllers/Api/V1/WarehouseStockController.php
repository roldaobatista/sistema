<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WarehouseStock;
use App\Models\Warehouse;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WarehouseStockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = WarehouseStock::with(['warehouse', 'product', 'batch']);

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
    }

    public function byWarehouse(Warehouse $warehouse): JsonResponse
    {
        $stocks = WarehouseStock::where('warehouse_id', $warehouse->id)
            ->with(['product:id,name,code,unit', 'batch'])
            ->where('quantity', '>', 0)
            ->get();

        return response()->json([
            'warehouse' => $warehouse,
            'data' => $stocks
        ]);
    }

    public function byProduct(Product $product): JsonResponse
    {
        $stocks = WarehouseStock::where('product_id', $product->id)
            ->with(['warehouse:id,name,type', 'batch'])
            ->where('quantity', '>', 0)
            ->get();

        return response()->json([
            'product' => $product,
            'data' => $stocks
        ]);
    }
}
