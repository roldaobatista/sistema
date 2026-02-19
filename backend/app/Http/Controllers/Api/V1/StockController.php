<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class StockController extends Controller
{
    public function __construct(
        private readonly StockService $stockService,
    ) {}

    public function movements(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $query = StockMovement::where('tenant_id', $tenantId)
            ->with(['product:id,name,code,unit', 'createdByUser:id,name', 'workOrder:id,number,os_number'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->filled('work_order_id')) {
            $query->where('work_order_id', $request->work_order_id);
        }

        $movements = $query->paginate($request->integer('per_page', 25));

        return response()->json($movements);
    }

    public function summary(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $query = Product::where('tenant_id', $tenantId)->where('is_active', true);

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        $products = $query->select([
            'id', 'code', 'name', 'unit', 'cost_price', 'sell_price',
            'stock_qty', 'stock_min', 'category_id',
        ])
            ->with('category:id,name')
            ->orderBy('name')
            ->get();

        $totalProducts = $products->count();
        $totalValue = $products->sum(fn ($p) => $p->stock_qty * $p->cost_price);
        $lowStockCount = $products->filter(fn ($p) => $p->stock_min > 0 && $p->stock_qty > 0 && $p->stock_qty <= $p->stock_min)->count();
        $outOfStockCount = $products->filter(fn ($p) => $p->stock_qty <= 0)->count();

        return response()->json([
            'products' => $products,
            'stats' => [
                'total_products' => $totalProducts,
                'total_value' => round($totalValue, 2),
                'low_stock_count' => $lowStockCount,
                'out_of_stock_count' => $outOfStockCount,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $validated = $request->validate([
            'product_id' => "required|exists:products,id,tenant_id,{$tenantId}",
            'warehouse_id' => "required|exists:warehouses,id,tenant_id,{$tenantId}",
            'batch_id' => "nullable|exists:batches,id,tenant_id,{$tenantId}",
            'product_serial_id' => "nullable|exists:product_serials,id,tenant_id,{$tenantId}",
            'type' => 'required|in:entry,exit,reserve,return,adjustment',
            'quantity' => 'required|numeric|min:0.01',
            'unit_cost' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            $product = Product::findOrFail($validated['product_id']);
            $type = StockMovementType::from($validated['type']);

            $movement = match ($type) {
                StockMovementType::Entry => $this->stockService->manualEntry(
                    product: $product,
                    qty: $validated['quantity'],
                    warehouseId: $validated['warehouse_id'],
                    batchId: $validated['batch_id'] ?? null,
                    serialId: $validated['product_serial_id'] ?? null,
                    unitCost: $validated['unit_cost'] ?? $product->cost_price,
                    notes: $validated['notes'] ?? null,
                    user: $request->user(),
                ),
                StockMovementType::Exit => $this->stockService->manualExit(
                    product: $product,
                    qty: $validated['quantity'],
                    warehouseId: $validated['warehouse_id'],
                    batchId: $validated['batch_id'] ?? null,
                    serialId: $validated['product_serial_id'] ?? null,
                    notes: $validated['notes'] ?? null,
                    user: $request->user(),
                ),
                StockMovementType::Return => $this->stockService->manualReturn(
                    product: $product,
                    qty: $validated['quantity'],
                    warehouseId: $validated['warehouse_id'],
                    batchId: $validated['batch_id'] ?? null,
                    serialId: $validated['product_serial_id'] ?? null,
                    notes: $validated['notes'] ?? null,
                    user: $request->user(),
                ),
                StockMovementType::Reserve => $this->stockService->manualReserve(
                    product: $product,
                    qty: $validated['quantity'],
                    warehouseId: $validated['warehouse_id'],
                    batchId: $validated['batch_id'] ?? null,
                    serialId: $validated['product_serial_id'] ?? null,
                    notes: $validated['notes'] ?? null,
                    user: $request->user(),
                ),
                StockMovementType::Adjustment => $this->stockService->manualAdjustment(
                    product: $product,
                    qty: $validated['quantity'],
                    warehouseId: $validated['warehouse_id'],
                    batchId: $validated['batch_id'] ?? null,
                    serialId: $validated['product_serial_id'] ?? null,
                    notes: $validated['notes'] ?? null,
                    user: $request->user(),
                ),
                default => abort(422, 'Tipo de movimentação inválido para entrada manual.'),
            };

            $movement->load(['product:id,name,code,stock_qty', 'createdByUser:id,name']);

            return response()->json([
                'message' => 'Movimentação registrada com sucesso.',
                'data' => $movement,
            ], 201);
        } catch (\Exception $e) {
            Log::error('StockController::store failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao registrar movimentação.'], 500);
        }
    }

    public function lowStockAlerts(): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $products = Product::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('stock_min', '>', 0)
            ->whereColumn('stock_qty', '<=', 'stock_min')
            ->select(['id', 'code', 'name', 'unit', 'stock_qty', 'stock_min', 'cost_price', 'category_id'])
            ->with('category:id,name')
            ->orderByRaw('(stock_min - stock_qty) DESC')
            ->get();

        return response()->json([
            'data' => $products,
            'total' => $products->count(),
        ]);
    }
}
