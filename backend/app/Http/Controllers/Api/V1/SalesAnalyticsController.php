<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Quote;
use App\Models\CrmDeal;
use App\Models\Customer;
use App\Models\AccountReceivable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SalesAnalyticsController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function quoteRentability(Quote $quote): JsonResponse
    {
        try {
            $items = $quote->equipments()->with('items.product', 'items.service')->get();

            $totalRevenue = 0;
            $totalCost = 0;
            $breakdown = [];

            foreach ($items as $equipment) {
                foreach ($equipment->items ?? [] as $item) {
                    $unitPrice = (float) ($item->unit_price ?? 0);
                    $qty = (float) ($item->quantity ?? 1);
                    $cost = 0;

                    if ($item->product) {
                        $cost = (float) ($item->product->cost_price ?? 0) * $qty;
                    }

                    $lineTotal = $unitPrice * $qty;
                    $totalRevenue += $lineTotal;
                    $totalCost += $cost;

                    $breakdown[] = [
                        'description' => $item->description ?? $item->product?->name ?? 'Item',
                        'quantity' => $qty,
                        'unit_price' => round($unitPrice, 2),
                        'cost' => round($cost, 2),
                        'margin' => $lineTotal > 0 ? round((($lineTotal - $cost) / $lineTotal) * 100, 1) : 0,
                    ];
                }
            }

            $discountAmount = (float) ($quote->discount_amount ?? 0);
            $netRevenue = $totalRevenue - $discountAmount;
            $profit = $netRevenue - $totalCost;

            return response()->json([
                'data' => [
                    'quote_id' => $quote->id,
                    'total_revenue' => round($totalRevenue, 2),
                    'discount' => round($discountAmount, 2),
                    'net_revenue' => round($netRevenue, 2),
                    'total_cost' => round($totalCost, 2),
                    'profit' => round($profit, 2),
                    'margin_percent' => $netRevenue > 0 ? round(($profit / $netRevenue) * 100, 1) : 0,
                    'min_acceptable_margin' => 15.0,
                    'is_profitable' => $profit > 0,
                    'breakdown' => $breakdown,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('SalesAnalytics quoteRentability failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao calcular rentabilidade'], 500);
        }
    }

    public function followUpQueue(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId();

            $quotes = Quote::where('tenant_id', $tenantId)
                ->whereIn('status', ['sent', 'pending', 'pending_internal_approval'])
                ->with(['customer:id,name,phone,email'])
                ->orderBy('valid_until')
                ->get()
                ->map(function ($q) {
                    $validUntil = $q->valid_until ? Carbon::parse($q->valid_until) : null;
                    $daysRemaining = $validUntil ? now()->diffInDays($validUntil, false) : null;

                    return [
                        'id' => $q->id,
                        'number' => $q->number ?? $q->id,
                        'customer' => $q->customer,
                        'total' => (float) $q->total,
                        'status' => $q->status,
                        'sent_at' => $q->sent_at,
                        'valid_until' => $q->valid_until,
                        'days_remaining' => $daysRemaining,
                        'priority' => match (true) {
                            $daysRemaining !== null && $daysRemaining < 0 => 'expired',
                            $daysRemaining !== null && $daysRemaining <= 3 => 'urgent',
                            $daysRemaining !== null && $daysRemaining <= 7 => 'high',
                            default => 'normal',
                        },
                        'last_activity' => $q->updated_at,
                    ];
                })
                ->sortBy(fn($item) => match ($item['priority']) {
                    'expired' => 0,
                    'urgent' => 1,
                    'high' => 2,
                    default => 3,
                })
                ->values();

            return response()->json([
                'data' => $quotes,
                'summary' => [
                    'total' => $quotes->count(),
                    'expired' => $quotes->where('priority', 'expired')->count(),
                    'urgent' => $quotes->where('priority', 'urgent')->count(),
                    'total_value' => round($quotes->sum('total'), 2),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('SalesAnalytics followUpQueue failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar fila de follow-up'], 500);
        }
    }

    public function lossReasons(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId();
            $from = Carbon::parse($request->input('from', now()->subMonths(6)));
            $to = Carbon::parse($request->input('to', now()));

            $reasons = CrmDeal::where('tenant_id', $tenantId)
                ->where('status', 'lost')
                ->whereBetween('closed_at', [$from, $to])
                ->select('loss_reason', DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(value), 0) as total_value'))
                ->groupBy('loss_reason')
                ->orderByDesc('count')
                ->get()
                ->map(function ($r) {
                    return [
                        'reason' => $r->loss_reason ?: 'Não informado',
                        'count' => $r->count,
                        'total_value' => round((float) $r->total_value, 2),
                    ];
                });

            $totalLost = $reasons->sum('count');

            return response()->json([
                'data' => $reasons->map(fn($r) => array_merge($r, [
                    'percentage' => $totalLost > 0 ? round(($r['count'] / $totalLost) * 100, 1) : 0,
                ])),
                'summary' => [
                    'total_lost' => $totalLost,
                    'total_value_lost' => round($reasons->sum('total_value'), 2),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('SalesAnalytics lossReasons failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao analisar motivos de perda'], 500);
        }
    }

    public function clientSegmentation(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId();
            $months = min((int) $request->input('months', 12), 36);

            $customers = AccountReceivable::where('tenant_id', $tenantId)
                ->where('status', 'paid')
                ->where('paid_at', '>=', now()->subMonths($months))
                ->select('customer_id', DB::raw('COALESCE(SUM(net_amount), 0) as revenue'), DB::raw('COUNT(*) as transactions'))
                ->groupBy('customer_id')
                ->orderByDesc('revenue')
                ->get();

            $totalRevenue = $customers->sum('revenue');
            $cumulative = 0;

            $segmented = $customers->map(function ($c) use ($totalRevenue, &$cumulative) {
                $cumulative += (float) $c->revenue;
                $cumulativePercent = $totalRevenue > 0 ? ($cumulative / $totalRevenue) * 100 : 0;

                $segment = match (true) {
                    $cumulativePercent <= 80 => 'A',
                    $cumulativePercent <= 95 => 'B',
                    default => 'C',
                };

                $customer = Customer::select('id', 'name', 'email')->find($c->customer_id);

                return [
                    'customer_id' => $c->customer_id,
                    'name' => $customer?->name ?? 'N/A',
                    'revenue' => round((float) $c->revenue, 2),
                    'transactions' => $c->transactions,
                    'revenue_percent' => $totalRevenue > 0 ? round(((float) $c->revenue / $totalRevenue) * 100, 1) : 0,
                    'cumulative_percent' => round($cumulativePercent, 1),
                    'segment' => $segment,
                ];
            });

            $summary = $segmented->groupBy('segment')->map(fn($group) => [
                'count' => $group->count(),
                'revenue' => round($group->sum('revenue'), 2),
                'percent_customers' => $segmented->count() > 0 ? round(($group->count() / $segmented->count()) * 100, 1) : 0,
                'percent_revenue' => $totalRevenue > 0 ? round(($group->sum('revenue') / $totalRevenue) * 100, 1) : 0,
            ]);

            return response()->json([
                'data' => $segmented,
                'summary' => $summary,
                'total_revenue' => round($totalRevenue, 2),
                'total_customers' => $segmented->count(),
            ]);
        } catch (\Exception $e) {
            Log::error('SalesAnalytics clientSegmentation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao calcular segmentação'], 500);
        }
    }

    public function upsellSuggestions(Customer $customer): JsonResponse
    {
        try {
            $tenantId = $this->tenantId();

            $purchasedServiceIds = DB::table('work_order_items')
                ->join('work_orders', 'work_order_items.work_order_id', '=', 'work_orders.id')
                ->where('work_orders.customer_id', $customer->id)
                ->where('work_orders.tenant_id', $tenantId)
                ->where('work_order_items.type', 'service')
                ->pluck('work_order_items.service_id')
                ->unique();

            $suggestions = DB::table('work_order_items')
                ->join('work_orders', 'work_order_items.work_order_id', '=', 'work_orders.id')
                ->where('work_orders.tenant_id', $tenantId)
                ->where('work_order_items.type', 'service')
                ->whereNotIn('work_order_items.service_id', $purchasedServiceIds)
                ->select(
                    'work_order_items.service_id',
                    DB::raw('COUNT(DISTINCT work_orders.customer_id) as customer_count'),
                    DB::raw('COUNT(*) as usage_count'),
                    DB::raw('AVG(work_order_items.unit_price) as avg_price')
                )
                ->groupBy('work_order_items.service_id')
                ->orderByDesc('customer_count')
                ->limit(10)
                ->get()
                ->map(function ($s) {
                    $service = DB::table('services')->find($s->service_id);
                    return [
                        'service_id' => $s->service_id,
                        'name' => $service?->name ?? 'Serviço',
                        'avg_price' => round((float) $s->avg_price, 2),
                        'customer_count' => $s->customer_count,
                        'usage_count' => $s->usage_count,
                        'reason' => "{$s->customer_count} outros clientes já contrataram este serviço",
                    ];
                });

            return response()->json(['data' => $suggestions]);
        } catch (\Exception $e) {
            Log::error('SalesAnalytics upsellSuggestions failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar sugestões de upsell'], 500);
        }
    }

    public function discountRequests(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId();

            $quotes = Quote::where('tenant_id', $tenantId)
                ->where('discount_amount', '>', 0)
                ->where('status', 'pending_internal_approval')
                ->with(['customer:id,name', 'createdBy:id,name'])
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($quotes);
        } catch (\Exception $e) {
            Log::error('SalesAnalytics discountRequests failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar solicitações de desconto'], 500);
        }
    }
}
