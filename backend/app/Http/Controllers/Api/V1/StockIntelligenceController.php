<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StockIntelligenceController extends Controller
{
    public function abcCurve(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'months' => 'nullable|integer|min:1|max:24',
            ]);

            $months = (int) ($request->months ?? 12);
            $since = now()->subMonths($months);

            $tenantId = app('current_tenant_id');
            $items = DB::table('stock_movements')
                ->join('products', 'stock_movements.product_id', '=', 'products.id')
                ->where('stock_movements.type', 'exit')
                ->where('stock_movements.created_at', '>=', $since)
                ->where('stock_movements.tenant_id', $tenantId)
                ->where('products.tenant_id', $tenantId)
                ->select(
                    'products.id',
                    'products.name',
                    'products.code',
                    'products.unit',
                    DB::raw('SUM(ABS(stock_movements.quantity)) as total_qty'),
                    DB::raw('SUM(ABS(stock_movements.quantity) * stock_movements.unit_cost) as total_value'),
                )
                ->groupBy('products.id', 'products.name', 'products.code', 'products.unit')
                ->orderByDesc('total_value')
                ->get();

            $grandTotal = $items->sum('total_value');
            $cumulative = 0;
            $classified = $items->map(function ($item) use ($grandTotal, &$cumulative) {
                $pct = $grandTotal > 0 ? ($item->total_value / $grandTotal) * 100 : 0;
                $cumulative += $pct;

                $class = match (true) {
                    $cumulative <= 80 => 'A',
                    $cumulative <= 95 => 'B',
                    default => 'C',
                };

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'code' => $item->code,
                    'unit' => $item->unit,
                    'total_qty' => round($item->total_qty, 2),
                    'total_value' => round($item->total_value, 2),
                    'percentage' => round($pct, 2),
                    'cumulative' => round($cumulative, 2),
                    'class' => $class,
                ];
            });

            $summary = [
                'A' => $classified->where('class', 'A')->count(),
                'B' => $classified->where('class', 'B')->count(),
                'C' => $classified->where('class', 'C')->count(),
                'total_value' => round($grandTotal, 2),
                'period_months' => $months,
            ];

            return response()->json(['data' => $classified->values(), 'summary' => $summary]);
        } catch (\Exception $e) {
            Log::error('StockIntelligence abcCurve failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao calcular curva ABC'], 500);
        }
    }

    public function turnover(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'months' => 'nullable|integer|min:1|max:24',
            ]);

            $months = (int) ($request->months ?? 12);
            $since = now()->subMonths($months);
            $tenantId = app('current_tenant_id');

            $items = DB::table('products')
                ->leftJoin('stock_movements', function ($join) use ($since, $tenantId) {
                    $join->on('stock_movements.product_id', '=', 'products.id')
                        ->where('stock_movements.tenant_id', $tenantId)
                        ->where('stock_movements.type', 'exit')
                        ->where('stock_movements.created_at', '>=', $since);
                })
                ->where('products.tenant_id', $tenantId)
                ->where('products.type', 'product')
                ->select(
                    'products.id',
                    'products.name',
                    'products.code',
                    'products.unit',
                    'products.stock_qty',
                    DB::raw('COALESCE(SUM(ABS(stock_movements.quantity)), 0) as total_exits'),
                )
                ->groupBy('products.id', 'products.name', 'products.code', 'products.unit', 'products.stock_qty')
                ->orderByDesc('total_exits')
                ->get();

            $result = $items->map(function ($item) use ($months) {
                $stockQty = (float) $item->stock_qty;
                $exits = (float) $item->total_exits;

                $turnoverRate = $stockQty > 0 ? round($exits / $stockQty, 2) : ($exits > 0 ? 999 : 0);

                $dailyExits = $months > 0 ? $exits / ($months * 30) : 0;
                $coverageDays = $dailyExits > 0 ? round($stockQty / $dailyExits) : ($stockQty > 0 ? 999 : 0);

                $classification = match (true) {
                    $turnoverRate >= 6 => 'fast',
                    $turnoverRate >= 2 => 'normal',
                    $turnoverRate > 0 => 'slow',
                    default => 'stale',
                };

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'code' => $item->code,
                    'unit' => $item->unit,
                    'stock_qty' => round($stockQty, 2),
                    'total_exits' => round($exits, 2),
                    'turnover_rate' => $turnoverRate,
                    'coverage_days' => min($coverageDays, 999),
                    'classification' => $classification,
                ];
            });

            $summary = [
                'fast' => $result->where('classification', 'fast')->count(),
                'normal' => $result->where('classification', 'normal')->count(),
                'slow' => $result->where('classification', 'slow')->count(),
                'stale' => $result->where('classification', 'stale')->count(),
                'period_months' => $months,
            ];

            return response()->json(['data' => $result->values(), 'summary' => $summary]);
        } catch (\Exception $e) {
            Log::error('StockIntelligence turnover failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao calcular giro de estoque'], 500);
        }
    }

    public function averageCost(Request $request): JsonResponse
    {
        try {
            $tenantId = app('current_tenant_id');

            $items = DB::table('products')
                ->leftJoin('stock_movements', function ($join) use ($tenantId) {
                    $join->on('stock_movements.product_id', '=', 'products.id')
                        ->where('stock_movements.tenant_id', $tenantId)
                        ->where('stock_movements.type', 'entry')
                        ->where('stock_movements.unit_cost', '>', 0);
                })
                ->where('products.tenant_id', $tenantId)
                ->where('products.type', 'product')
                ->select(
                    'products.id',
                    'products.name',
                    'products.code',
                    'products.unit',
                    'products.stock_qty',
                    'products.cost_price',
                    DB::raw('COALESCE(SUM(ABS(stock_movements.quantity) * stock_movements.unit_cost), 0) as total_cost'),
                    DB::raw('COALESCE(SUM(ABS(stock_movements.quantity)), 0) as total_qty_entered'),
                )
                ->groupBy('products.id', 'products.name', 'products.code', 'products.unit', 'products.stock_qty', 'products.cost_price')
                ->orderBy('products.name')
                ->get();

            $result = $items->map(function ($item) {
                $avgCost = $item->total_qty_entered > 0
                    ? round($item->total_cost / $item->total_qty_entered, 4)
                    : (float) $item->cost_price;
                $stockValue = round($avgCost * (float) $item->stock_qty, 2);

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'code' => $item->code,
                    'unit' => $item->unit,
                    'stock_qty' => round((float) $item->stock_qty, 2),
                    'current_cost' => round((float) $item->cost_price, 4),
                    'average_cost' => $avgCost,
                    'total_entries' => round((float) $item->total_qty_entered, 2),
                    'stock_value' => $stockValue,
                ];
            });

            $totalValue = $result->sum('stock_value');

            return response()->json(['data' => $result->values(), 'total_value' => round($totalValue, 2)]);
        } catch (\Exception $e) {
            Log::error('StockIntelligence averageCost failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao calcular custo médio'], 500);
        }
    }

    public function reorderPoints(Request $request): JsonResponse
    {
        try {
            $request->validate(['months' => 'nullable|integer|min:1|max:24']);
            $tenantId = app('current_tenant_id');
            $months = (int) ($request->months ?? 3);
            $since = now()->subMonths($months);

            $items = DB::table('products')
                ->leftJoin('stock_movements', function ($join) use ($since, $tenantId) {
                    $join->on('stock_movements.product_id', '=', 'products.id')
                        ->where('stock_movements.tenant_id', $tenantId)
                        ->where('stock_movements.type', 'exit')
                        ->where('stock_movements.created_at', '>=', $since);
                })
                ->where('products.tenant_id', $tenantId)
                ->where('products.type', 'product')
                ->where('products.stock_min', '>', 0)
                ->select(
                    'products.id',
                    'products.name',
                    'products.code',
                    'products.unit',
                    'products.stock_qty',
                    'products.stock_min',
                    'products.cost_price',
                    DB::raw('COALESCE(SUM(ABS(stock_movements.quantity)), 0) as total_exits'),
                )
                ->groupBy('products.id', 'products.name', 'products.code', 'products.unit', 'products.stock_qty', 'products.stock_min', 'products.cost_price')
                ->orderBy('products.stock_qty')
                ->get();

            $result = $items->map(function ($item) use ($months) {
                $stockQty = (float) $item->stock_qty;
                $stockMin = (float) $item->stock_min;
                $exits = (float) $item->total_exits;

                $dailyConsumption = $months > 0 ? $exits / ($months * 30) : 0;
                $daysUntilMin = $dailyConsumption > 0 ? round(max(0, $stockQty - $stockMin) / $dailyConsumption) : 999;
                $suggestedQty = max(0, round($stockMin * 2 - $stockQty, 2));
                $estimatedCost = round($suggestedQty * (float) $item->cost_price, 2);

                $urgency = match (true) {
                    $stockQty <= 0 => 'critical',
                    $stockQty <= $stockMin => 'urgent',
                    $daysUntilMin <= 7 => 'soon',
                    default => 'ok',
                };

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'code' => $item->code,
                    'unit' => $item->unit,
                    'stock_qty' => round($stockQty, 2),
                    'stock_min' => round($stockMin, 2),
                    'daily_consumption' => round($dailyConsumption, 3),
                    'days_until_min' => min($daysUntilMin, 999),
                    'suggested_qty' => $suggestedQty,
                    'estimated_cost' => $estimatedCost,
                    'urgency' => $urgency,
                ];
            });

            $needAttention = $result->whereIn('urgency', ['critical', 'urgent', 'soon'])->values();
            $totalEstimated = $needAttention->sum('estimated_cost');

            return response()->json([
                'data' => $needAttention,
                'all' => $result->values(),
                'summary' => [
                    'critical' => $result->where('urgency', 'critical')->count(),
                    'urgent' => $result->where('urgency', 'urgent')->count(),
                    'soon' => $result->where('urgency', 'soon')->count(),
                    'ok' => $result->where('urgency', 'ok')->count(),
                    'estimated_reorder_cost' => round($totalEstimated, 2),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('StockIntelligence reorderPoints failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao calcular pontos de reposição'], 500);
        }
    }

    public function reservations(Request $request): JsonResponse
    {
        try {
            $tenantId = app('current_tenant_id');

            $reservations = StockMovement::with(['product:id,name,code,unit', 'workOrder:id,number', 'warehouse:id,name'])
                ->where('tenant_id', $tenantId)
                ->where('type', 'reserve')
                ->orderByDesc('created_at')
                ->paginate($request->integer('per_page', 50));

            $reservations->getCollection()->transform(fn ($m) => [
                'id' => $m->id,
                'product' => $m->product ? ['id' => $m->product->id, 'name' => $m->product->name, 'code' => $m->product->code] : null,
                'warehouse' => $m->warehouse ? ['id' => $m->warehouse->id, 'name' => $m->warehouse->name] : null,
                'work_order' => $m->workOrder ? ['id' => $m->workOrder->id, 'number' => $m->workOrder->number] : null,
                'quantity' => abs((float) $m->quantity),
                'reference' => $m->reference,
                'notes' => $m->notes,
                'created_at' => $m->created_at->toISOString(),
            ]);

            return response()->json($reservations);
        } catch (\Exception $e) {
            Log::error('StockIntelligence reservations failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar reservas'], 500);
        }
    }
}
