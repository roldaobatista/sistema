<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\StockService;
use App\Models\Product;
use App\Models\WorkOrder;
use App\Models\PurchaseOrder;
use App\Models\WarrantyTracking;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class StockAdvancedController extends Controller
{
    public function __construct(private StockService $stockService) {}

    // ─── #16B Compra Automática por Reorder Point ───────────────

    public function autoReorder(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;

        $belowReorder = DB::table('products')
            ->where('company_id', $tenantId)
            ->where('is_active', true)
            ->whereNotNull('reorder_point')
            ->whereRaw('current_stock <= reorder_point')
            ->get();

        $orders = [];
        foreach ($belowReorder as $product) {
            $orderQty = ($product->max_stock ?? ($product->reorder_point * 2)) - $product->current_stock;
            if ($orderQty <= 0) continue;

            $hasPending = DB::table('purchase_order_items')
                ->join('purchase_orders', 'purchase_order_items.purchase_order_id', '=', 'purchase_orders.id')
                ->where('purchase_orders.company_id', $tenantId)
                ->where('purchase_orders.status', 'pending')
                ->where('purchase_order_items.product_id', $product->id)
                ->exists();

            if ($hasPending) continue;

            $orders[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'current_stock' => $product->current_stock,
                'reorder_point' => $product->reorder_point,
                'suggested_quantity' => $orderQty,
                'preferred_supplier_id' => $product->default_supplier_id,
            ];
        }

        return response()->json([
            'products_below_reorder' => count($orders),
            'suggestions' => $orders,
        ]);
    }

    public function createAutoReorderPO(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:1',
            'items.*.supplier_id' => 'required|integer|exists:suppliers,id',
        ]);

        $tenantId = $request->user()->company_id;
        $grouped = collect($request->input('items'))->groupBy('supplier_id');
        $created = [];

        DB::beginTransaction();
        try {
            foreach ($grouped as $supplierId => $items) {
                $po = PurchaseOrder::create([
                    'company_id' => $tenantId,
                    'supplier_id' => $supplierId,
                    'status' => 'pending',
                    'origin' => 'auto_reorder',
                    'created_by' => $request->user()->id,
                ]);

                $total = 0;
                foreach ($items as $item) {
                    $product = Product::find($item['product_id']);
                    $unitCost = $product->cost_price ?? 0;
                    DB::table('purchase_order_items')->insert([
                        'purchase_order_id' => $po->id,
                        'product_id' => $item['product_id'],
                        'quantity' => $item['quantity'],
                        'unit_cost' => $unitCost,
                        'total' => $unitCost * $item['quantity'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $total += $unitCost * $item['quantity'];
                }

                $po->update(['total' => $total]);
                $created[] = $po->id;
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }

        return response()->json([
            'message' => count($created) . ' purchase orders created',
            'purchase_order_ids' => $created,
        ], 201);
    }

    // ─── #17 Baixa Automática de Estoque na OS ─────────────────

    public function autoDeductFromWO(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $tenantId = $request->user()->company_id;

        if ($workOrder->company_id !== $tenantId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $parts = DB::table('work_order_parts')
            ->where('work_order_id', $workOrder->id)
            ->where('deducted', false)
            ->get();

        if ($parts->isEmpty()) {
            return response()->json(['message' => 'No parts to deduct']);
        }

        $deducted = [];
        $errors = [];

        foreach ($parts as $part) {
            try {
                $product = Product::findOrFail($part->product_id);
                $this->stockService->createMovement(
                    product: $product,
                    type: \App\Enums\StockMovementType::DEDUCTED,
                    quantity: $part->quantity,
                    warehouseId: $part->warehouse_id ?? $workOrder->warehouse_id,
                    workOrder: $workOrder,
                    reference: "Auto-deduct OS #{$workOrder->id}",
                    unitCost: $product->cost_price ?? 0,
                    user: $request->user(),
                );

                DB::table('work_order_parts')
                    ->where('id', $part->id)
                    ->update(['deducted' => true, 'deducted_at' => now()]);

                $deducted[] = $part->product_id;
            } catch (\Throwable $e) {
                $errors[] = "Product #{$part->product_id}: {$e->getMessage()}";
            }
        }

        return response()->json([
            'deducted' => count($deducted),
            'errors' => $errors,
        ]);
    }

    // ─── #18 Inventário Cíclico com QR Code ────────────────────

    public function startCyclicCount(Request $request): JsonResponse
    {
        $request->validate([
            'warehouse_id' => 'required|integer|exists:warehouses,id',
            'product_ids' => 'nullable|array',
            'category' => 'nullable|string',
        ]);

        $tenantId = $request->user()->company_id;

        $query = Product::where('company_id', $tenantId)->where('is_active', true);

        if ($request->filled('product_ids')) {
            $query->whereIn('id', $request->input('product_ids'));
        }
        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        $products = $query->get(['id', 'name', 'sku', 'barcode', 'current_stock']);

        $countSession = DB::table('inventory_counts')->insertGetId([
            'company_id' => $tenantId,
            'warehouse_id' => $request->input('warehouse_id'),
            'status' => 'in_progress',
            'started_by' => $request->user()->id,
            'items_count' => $products->count(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($products as $product) {
            DB::table('inventory_count_items')->insert([
                'inventory_count_id' => $countSession,
                'product_id' => $product->id,
                'system_quantity' => $product->current_stock,
                'counted_quantity' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json([
            'count_id' => $countSession,
            'items' => $products->count(),
            'message' => 'Cyclic inventory count started',
        ], 201);
    }

    public function submitCount(Request $request, int $countId): JsonResponse
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer',
            'items.*.counted_quantity' => 'required|numeric|min:0',
        ]);

        foreach ($request->input('items') as $item) {
            DB::table('inventory_count_items')
                ->where('inventory_count_id', $countId)
                ->where('product_id', $item['product_id'])
                ->update([
                    'counted_quantity' => $item['counted_quantity'],
                    'counted_by' => $request->user()->id,
                    'counted_at' => now(),
                    'updated_at' => now(),
                ]);
        }

        $pending = DB::table('inventory_count_items')
            ->where('inventory_count_id', $countId)
            ->whereNull('counted_quantity')
            ->count();

        if ($pending === 0) {
            DB::table('inventory_counts')
                ->where('id', $countId)
                ->update(['status' => 'completed', 'completed_at' => now(), 'updated_at' => now()]);
        }

        $divergences = DB::table('inventory_count_items')
            ->where('inventory_count_id', $countId)
            ->whereNotNull('counted_quantity')
            ->whereRaw('counted_quantity != system_quantity')
            ->get();

        return response()->json([
            'pending_items' => $pending,
            'divergences' => $divergences->count(),
            'divergence_details' => $divergences,
        ]);
    }

    // ─── #19B Rastreabilidade de Garantia ───────────────────────

    public function warrantyLookup(Request $request): JsonResponse
    {
        $request->validate([
            'serial_number' => 'nullable|string',
            'work_order_id' => 'nullable|integer',
            'equipment_id' => 'nullable|integer',
        ]);

        $tenantId = $request->user()->company_id;
        $query = WarrantyTracking::where('company_id', $tenantId);

        if ($request->filled('serial_number')) {
            $query->where('serial_number', $request->input('serial_number'));
        }
        if ($request->filled('work_order_id')) {
            $query->where('work_order_id', $request->input('work_order_id'));
        }
        if ($request->filled('equipment_id')) {
            $query->where('equipment_id', $request->input('equipment_id'));
        }

        $warranties = $query->with(['workOrder', 'product', 'equipment'])->get();

        return response()->json([
            'total' => $warranties->count(),
            'active' => $warranties->filter(fn ($w) => Carbon::parse($w->warranty_end)->isFuture())->count(),
            'expired' => $warranties->filter(fn ($w) => Carbon::parse($w->warranty_end)->isPast())->count(),
            'warranties' => $warranties,
        ]);
    }

    // ─── #20B Comparador Automático de Cotações ─────────────────

    public function comparePurchaseQuotes(Request $request): JsonResponse
    {
        $request->validate([
            'purchase_quote_ids' => 'required|array|min:2',
        ]);

        $tenantId = $request->user()->company_id;
        $quotes = DB::table('purchase_quotes')
            ->where('company_id', $tenantId)
            ->whereIn('id', $request->input('purchase_quote_ids'))
            ->get();

        $comparison = [];
        foreach ($quotes as $quote) {
            $items = DB::table('purchase_quote_items')
                ->where('purchase_quote_id', $quote->id)
                ->get();

            $comparison[] = [
                'quote_id' => $quote->id,
                'supplier' => $quote->supplier_name ?? "Supplier #{$quote->supplier_id}",
                'total' => $items->sum('total'),
                'delivery_days' => $quote->delivery_days ?? null,
                'payment_terms' => $quote->payment_terms ?? null,
                'items_count' => $items->count(),
            ];
        }

        $minTotal = collect($comparison)->min('total');
        $scored = collect($comparison)->map(function ($q) use ($minTotal) {
            $priceScore = $minTotal > 0 ? round(($minTotal / $q['total']) * 100, 1) : 100;
            $deliveryScore = isset($q['delivery_days']) ? max(0, 100 - $q['delivery_days'] * 5) : 50;
            $q['score'] = round($priceScore * 0.7 + $deliveryScore * 0.3, 1);
            return $q;
        })->sortByDesc('score')->values();

        return response()->json([
            'comparison' => $scored,
            'recommended' => $scored->first(),
        ]);
    }

    // ─── #21B Análise de Estoque de Giro Lento ─────────────────

    public function slowMovingAnalysis(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $days = $request->input('days', 90);
        $threshold = Carbon::now()->subDays($days);

        $slowMoving = DB::table('products')
            ->where('products.company_id', $tenantId)
            ->where('products.is_active', true)
            ->where('products.current_stock', '>', 0)
            ->leftJoin('stock_movements', function ($join) use ($threshold) {
                $join->on('products.id', '=', 'stock_movements.product_id')
                     ->where('stock_movements.created_at', '>=', $threshold)
                     ->whereIn('stock_movements.type', ['DEDUCTED', 'MANUAL_EXIT']);
            })
            ->selectRaw('products.id, products.name, products.sku, products.current_stock, 
                          products.cost_price, (products.current_stock * COALESCE(products.cost_price, 0)) as capital_invested,
                          COUNT(stock_movements.id) as movement_count,
                          MAX(stock_movements.created_at) as last_movement')
            ->groupBy('products.id', 'products.name', 'products.sku', 'products.current_stock', 'products.cost_price')
            ->having('movement_count', '=', 0)
            ->orderByDesc('capital_invested')
            ->limit(50)
            ->get();

        return response()->json([
            'period_days' => $days,
            'slow_moving_count' => $slowMoving->count(),
            'total_capital_locked' => round($slowMoving->sum('capital_invested'), 2),
            'products' => $slowMoving,
        ]);
    }
}
