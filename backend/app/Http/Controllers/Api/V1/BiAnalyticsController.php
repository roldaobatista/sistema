<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class BiAnalyticsController extends Controller
{
    // ─── #28 Dashboard KPIs em Tempo Real ───────────────────────

    public function realtimeKpis(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $today = Carbon::today();

        $osToday = WorkOrder::where('company_id', $tenantId)->whereDate('created_at', $today)->count();
        $osCompleted = WorkOrder::where('company_id', $tenantId)
            ->whereIn('status', ['concluida', 'faturada'])
            ->whereDate('updated_at', $today)->count();
        $osOpen = WorkOrder::where('company_id', $tenantId)
            ->whereNotIn('status', ['concluida', 'cancelada', 'faturada'])->count();

        $revenueToday = DB::table('account_receivables')
            ->where('company_id', $tenantId)->where('status', 'PAGO')
            ->whereDate('data_pagamento', $today)->sum('valor_pago');

        $revenueMonth = DB::table('account_receivables')
            ->where('company_id', $tenantId)->where('status', 'PAGO')
            ->whereMonth('data_pagamento', now()->month)
            ->whereYear('data_pagamento', now()->year)->sum('valor_pago');

        $overdue = DB::table('account_receivables')
            ->where('company_id', $tenantId)->where('status', '!=', 'PAGO')
            ->where('data_vencimento', '<', now())->sum('valor');

        $nps = DB::table('nps_responses')
            ->where('company_id', $tenantId)
            ->where('created_at', '>=', now()->subDays(30))->avg('score');

        $activeTechs = DB::table('users')
            ->join('model_has_roles', 'users.id', '=', 'model_has_roles.model_id')
            ->join('roles', 'model_has_roles.role_id', '=', 'roles.id')
            ->where('users.company_id', $tenantId)
            ->whereIn('roles.name', ['tecnico', 'technician'])
            ->where('users.is_active', true)->count();

        return response()->json([
            'timestamp' => now()->toIso8601String(),
            'os_today' => $osToday,
            'os_completed_today' => $osCompleted,
            'os_open' => $osOpen,
            'revenue_today' => round($revenueToday, 2),
            'revenue_month' => round($revenueMonth, 2),
            'overdue_total' => round($overdue, 2),
            'nps_30d' => $nps ? round($nps, 1) : null,
            'active_technicians' => $activeTechs,
        ]);
    }

    // ─── #29 Relatório de Lucratividade por OS ─────────────────

    public function profitabilityByOS(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->toDateString());

        $workOrders = WorkOrder::where('company_id', $tenantId)
            ->whereIn('status', ['concluida', 'faturada'])
            ->whereBetween('created_at', [$from, $to])
            ->get();

        $report = $workOrders->map(function ($wo) {
            $revenue = $wo->valor_total ?? 0;

            // Parts cost
            $partsCost = DB::table('work_order_parts')
                ->where('work_order_id', $wo->id)
                ->sum(DB::raw('quantity * unit_cost'));

            // Labor cost (hours × hourly rate)
            $laborCost = DB::table('time_entries')
                ->where('work_order_id', $wo->id)
                ->sum(DB::raw('(duration_minutes / 60.0) * hourly_rate'));

            // Commission cost
            $commissionCost = DB::table('commission_events')
                ->where('work_order_id', $wo->id)->sum('value');

            // Expenses
            $expenses = DB::table('expenses')
                ->where('work_order_id', $wo->id)->sum('valor');

            $totalCost = $partsCost + $laborCost + $commissionCost + $expenses;
            $profit = $revenue - $totalCost;

            return [
                'work_order_id' => $wo->id,
                'customer' => $wo->customer_name ?? "Client #{$wo->customer_id}",
                'type' => $wo->tipo,
                'revenue' => round($revenue, 2),
                'parts_cost' => round($partsCost, 2),
                'labor_cost' => round($laborCost, 2),
                'commission_cost' => round($commissionCost, 2),
                'expenses' => round($expenses, 2),
                'total_cost' => round($totalCost, 2),
                'profit' => round($profit, 2),
                'margin' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : 0,
            ];
        })->sortByDesc('profit')->values();

        $totals = [
            'revenue' => $report->sum('revenue'),
            'total_cost' => $report->sum('total_cost'),
            'profit' => $report->sum('profit'),
            'avg_margin' => $report->count() > 0 ? round($report->avg('margin'), 1) : 0,
        ];

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'work_orders' => $report->take(100),
            'totals' => $totals,
        ]);
    }

    // ─── #30 Alertas Inteligentes de Anomalias ─────────────────

    public function anomalyDetection(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $anomalies = [];

        // Revenue drop anomaly
        $currentMonthRev = DB::table('account_receivables')
            ->where('company_id', $tenantId)->where('status', 'PAGO')
            ->whereMonth('data_pagamento', now()->month)->sum('valor_pago');

        $lastMonthRev = DB::table('account_receivables')
            ->where('company_id', $tenantId)->where('status', 'PAGO')
            ->whereMonth('data_pagamento', now()->subMonth()->month)->sum('valor_pago');

        if ($lastMonthRev > 0 && $currentMonthRev < ($lastMonthRev * 0.7)) {
            $anomalies[] = [
                'type' => 'revenue_drop',
                'severity' => 'high',
                'message' => 'Receita caiu ' . round((1 - $currentMonthRev / $lastMonthRev) * 100, 1) . '% vs mês anterior',
                'current' => round($currentMonthRev, 2),
                'previous' => round($lastMonthRev, 2),
            ];
        }

        // OS completion rate drop
        $currentOsRate = $this->getCompletionRate($tenantId, now()->startOfMonth(), now());
        $lastOsRate = $this->getCompletionRate($tenantId, now()->subMonth()->startOfMonth(), now()->subMonth()->endOfMonth());

        if ($lastOsRate > 0 && $currentOsRate < ($lastOsRate * 0.8)) {
            $anomalies[] = [
                'type' => 'completion_rate_drop',
                'severity' => 'medium',
                'message' => 'Taxa de conclusão de OS caiu de ' . round($lastOsRate, 1) . '% para ' . round($currentOsRate, 1) . '%',
            ];
        }

        // Unusual expense spike
        $avgExpenses = DB::table('expenses')
            ->where('company_id', $tenantId)
            ->where('created_at', '>=', now()->subMonths(3))
            ->selectRaw('AVG(monthly_total) as avg_monthly')
            ->fromSub(function ($q) use ($tenantId) {
                $q->from('expenses')
                    ->where('company_id', $tenantId)
                    ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, SUM(valor) as monthly_total")
                    ->groupBy('month');
            }, 'monthly')
            ->value('avg_monthly');

        $currentExpenses = DB::table('expenses')
            ->where('company_id', $tenantId)
            ->whereMonth('created_at', now()->month)->sum('valor');

        if ($avgExpenses > 0 && $currentExpenses > ($avgExpenses * 1.5)) {
            $anomalies[] = [
                'type' => 'expense_spike',
                'severity' => 'medium',
                'message' => 'Despesas ' . round(($currentExpenses / $avgExpenses - 1) * 100, 1) . '% acima da média',
            ];
        }

        // High cancellation rate
        $totalOs = WorkOrder::where('company_id', $tenantId)
            ->whereMonth('created_at', now()->month)->count();
        $cancelledOs = WorkOrder::where('company_id', $tenantId)
            ->where('status', 'cancelada')
            ->whereMonth('created_at', now()->month)->count();

        if ($totalOs > 10 && ($cancelledOs / $totalOs) > 0.15) {
            $anomalies[] = [
                'type' => 'high_cancellation',
                'severity' => 'high',
                'message' => round(($cancelledOs / $totalOs) * 100, 1) . '% das OS canceladas este mês',
            ];
        }

        return response()->json([
            'anomalies_found' => count($anomalies),
            'anomalies' => $anomalies,
            'checked_at' => now()->toIso8601String(),
        ]);
    }

    // ─── #31 Exportação de Relatórios Agendada ─────────────────

    public function scheduledExports(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $exports = DB::table('scheduled_report_exports')
            ->where('company_id', $tenantId)->orderByDesc('created_at')->paginate(20);

        return response()->json($exports);
    }

    public function createScheduledExport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'report_type' => 'required|string|in:financial,os,stock,crm,productivity',
            'format' => 'required|string|in:xlsx,csv,pdf',
            'frequency' => 'required|string|in:daily,weekly,monthly',
            'recipients' => 'required|array|min:1',
            'recipients.*' => 'email',
            'filters' => 'nullable|array',
        ]);

        $data['company_id'] = $request->user()->company_id;
        $data['created_by'] = $request->user()->id;
        $data['is_active'] = true;
        $data['recipients'] = json_encode($data['recipients']);
        $data['filters'] = json_encode($data['filters'] ?? []);

        $id = DB::table('scheduled_report_exports')->insertGetId(array_merge($data, [
            'created_at' => now(), 'updated_at' => now(),
        ]));

        return response()->json(['id' => $id, 'message' => 'Scheduled export created'], 201);
    }

    public function deleteScheduledExport(Request $request, int $id): JsonResponse
    {
        DB::table('scheduled_report_exports')
            ->where('id', $id)->where('company_id', $request->user()->company_id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── #32 Comparativo Período a Período ─────────────────────

    public function periodComparison(Request $request): JsonResponse
    {
        $request->validate([
            'period1_from' => 'required|date',
            'period1_to' => 'required|date|after_or_equal:period1_from',
            'period2_from' => 'required|date',
            'period2_to' => 'required|date|after_or_equal:period2_from',
        ]);

        $tenantId = $request->user()->company_id;
        $p1 = [$request->input('period1_from'), $request->input('period1_to')];
        $p2 = [$request->input('period2_from'), $request->input('period2_to')];

        $metrics = ['os_created', 'os_completed', 'revenue', 'expenses', 'new_customers', 'avg_ticket'];

        $period1 = $this->getPeriodMetrics($tenantId, $p1[0], $p1[1]);
        $period2 = $this->getPeriodMetrics($tenantId, $p2[0], $p2[1]);

        $comparison = [];
        foreach ($metrics as $metric) {
            $v1 = $period1[$metric] ?? 0;
            $v2 = $period2[$metric] ?? 0;
            $change = $v1 > 0 ? round((($v2 - $v1) / $v1) * 100, 1) : ($v2 > 0 ? 100 : 0);

            $comparison[$metric] = [
                'period_1' => $v1,
                'period_2' => $v2,
                'change_percent' => $change,
                'trend' => $change > 0 ? 'up' : ($change < 0 ? 'down' : 'stable'),
            ];
        }

        return response()->json([
            'period_1' => ['from' => $p1[0], 'to' => $p1[1]],
            'period_2' => ['from' => $p2[0], 'to' => $p2[1]],
            'comparison' => $comparison,
        ]);
    }

    // ─── Helpers ────────────────────────────────────────────────

    private function getCompletionRate(int $tenantId, $from, $to): float
    {
        $total = WorkOrder::where('company_id', $tenantId)
            ->whereBetween('created_at', [$from, $to])->count();
        $completed = WorkOrder::where('company_id', $tenantId)
            ->whereIn('status', ['concluida', 'faturada'])
            ->whereBetween('created_at', [$from, $to])->count();

        return $total > 0 ? ($completed / $total) * 100 : 0;
    }

    private function getPeriodMetrics(int $tenantId, string $from, string $to): array
    {
        return [
            'os_created' => WorkOrder::where('company_id', $tenantId)
                ->whereBetween('created_at', [$from, $to])->count(),
            'os_completed' => WorkOrder::where('company_id', $tenantId)
                ->whereIn('status', ['concluida', 'faturada'])
                ->whereBetween('created_at', [$from, $to])->count(),
            'revenue' => round(DB::table('account_receivables')
                ->where('company_id', $tenantId)->where('status', 'PAGO')
                ->whereBetween('data_pagamento', [$from, $to])->sum('valor_pago'), 2),
            'expenses' => round(DB::table('account_payables')
                ->where('company_id', $tenantId)->where('status', 'PAGO')
                ->whereBetween('data_pagamento', [$from, $to])->sum('valor_pago'), 2),
            'new_customers' => DB::table('customers')
                ->where('company_id', $tenantId)
                ->whereBetween('created_at', [$from, $to])->count(),
            'avg_ticket' => round(WorkOrder::where('company_id', $tenantId)
                ->whereIn('status', ['concluida', 'faturada'])
                ->whereBetween('created_at', [$from, $to])
                ->avg('valor_total') ?? 0, 2),
        ];
    }
}
