<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\WorkOrder;
use App\Models\Quote;
use App\Models\ServiceCall;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use App\Models\Expense;
use App\Models\Customer;
use App\Models\Equipment;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AnalyticsController extends Controller
{
    /**
     * Resumo executivo cross-module: KPIs consolidados de todos os módulos.
     */
    public function executiveSummary(Request $request): JsonResponse
    {
        try {
            $from = $request->input('from', Carbon::now()->startOfMonth()->toDateString());
            $to = $request->input('to', Carbon::now()->endOfMonth()->toDateString());
            $tenantId = $request->user()?->tenant_id;

            // ── OS ──
            $osQuery = WorkOrder::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('created_at', [$from, Carbon::parse($to)->endOfDay()]);

            $totalOs = (clone $osQuery)->count();
            $osCompleted = (clone $osQuery)->where('status', 'completed')->count();
            $osPending = (clone $osQuery)->whereNotIn('status', ['completed', 'cancelled'])->count();
            $osCancelled = (clone $osQuery)->where('status', 'cancelled')->count();

            // ── Financeiro ──
            $arQuery = AccountReceivable::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('due_date', [$from, $to]);

            $totalReceivable = (clone $arQuery)->sum('amount');
            $totalReceived = (clone $arQuery)->where('status', 'paid')->sum('amount');
            $totalOverdue = AccountReceivable::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->where('status', 'pending')
                ->where('due_date', '<', Carbon::now())
                ->sum('amount');

            $apQuery = AccountPayable::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('due_date', [$from, $to]);

            $totalPayable = (clone $apQuery)->sum('amount');
            $totalPaid = (clone $apQuery)->where('status', 'paid')->sum('amount');

            // ── Despesas ──
            $totalExpenses = Expense::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('expense_date', [$from, $to])
                ->where('status', 'approved')
                ->sum('amount');

            // ── Orçamentos ──
            $quotesQuery = Quote::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('created_at', [$from, Carbon::parse($to)->endOfDay()]);

            $totalQuotes = (clone $quotesQuery)->count();
            $approvedQuotes = (clone $quotesQuery)->where('status', 'approved')->count();
            $conversionRate = $totalQuotes > 0 ? round(($approvedQuotes / $totalQuotes) * 100, 1) : 0;
            $quotesValue = (clone $quotesQuery)->sum('total');

            // ── Chamados ──
            $scQuery = ServiceCall::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('created_at', [$from, Carbon::parse($to)->endOfDay()]);

            $totalServiceCalls = (clone $scQuery)->count();
            $scCompleted = (clone $scQuery)->whereIn('status', ['completed', 'concluido'])->count();

            // ── Clientes ──
            $newCustomers = Customer::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('created_at', [$from, Carbon::parse($to)->endOfDay()])
                ->count();

            $totalCustomers = Customer::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->where('active', true)
                ->count();

            // ── Equipamentos ──
            $totalEquipments = Equipment::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->where('status', 'active')
                ->count();

            $calibrationsDue = Equipment::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->where('status', 'active')
                ->whereNotNull('next_calibration_date')
                ->where('next_calibration_date', '<=', Carbon::now()->addDays(30))
                ->count();

            // ── Período anterior (para comparação) ──
            $daysDiff = Carbon::parse($from)->diffInDays(Carbon::parse($to)) + 1;
            $prevFrom = Carbon::parse($from)->subDays($daysDiff)->toDateString();
            $prevTo = Carbon::parse($from)->subDay()->toDateString();

            $prevOs = WorkOrder::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('created_at', [$prevFrom, Carbon::parse($prevTo)->endOfDay()])
                ->count();

            $prevReceivable = AccountReceivable::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('due_date', [$prevFrom, $prevTo])
                ->sum('amount');

            $prevReceived = AccountReceivable::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('due_date', [$prevFrom, $prevTo])
                ->where('status', 'paid')
                ->sum('amount');

            $prevQuotes = Quote::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('created_at', [$prevFrom, Carbon::parse($prevTo)->endOfDay()])
                ->count();

            $prevQuotesApproved = Quote::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('created_at', [$prevFrom, Carbon::parse($prevTo)->endOfDay()])
                ->where('status', 'approved')
                ->count();

            $prevConversionRate = $prevQuotes > 0 ? round(($prevQuotesApproved / $prevQuotes) * 100, 1) : 0;

            $prevExpenses = Expense::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->whereBetween('expense_date', [$prevFrom, $prevTo])
                ->where('status', 'approved')
                ->sum('amount');

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'operational' => [
                    'total_os' => $totalOs,
                    'os_completed' => $osCompleted,
                    'os_pending' => $osPending,
                    'os_cancelled' => $osCancelled,
                    'completion_rate' => $totalOs > 0 ? round(($osCompleted / $totalOs) * 100, 1) : 0,
                    'total_service_calls' => $totalServiceCalls,
                    'sc_completed' => $scCompleted,
                    'prev_total_os' => $prevOs,
                ],
                'financial' => [
                    'total_receivable' => round((float) $totalReceivable, 2),
                    'total_received' => round((float) $totalReceived, 2),
                    'total_overdue' => round((float) $totalOverdue, 2),
                    'total_payable' => round((float) $totalPayable, 2),
                    'total_paid' => round((float) $totalPaid, 2),
                    'total_expenses' => round((float) $totalExpenses, 2),
                    'net_balance' => round((float) ($totalReceived - $totalPaid - $totalExpenses), 2),
                    'prev_total_receivable' => round((float) $prevReceivable, 2),
                    'prev_total_received' => round((float) $prevReceived, 2),
                    'prev_total_expenses' => round((float) $prevExpenses, 2),
                ],
                'commercial' => [
                    'total_quotes' => $totalQuotes,
                    'approved_quotes' => $approvedQuotes,
                    'conversion_rate' => $conversionRate,
                    'quotes_value' => round((float) $quotesValue, 2),
                    'new_customers' => $newCustomers,
                    'total_active_customers' => $totalCustomers,
                    'prev_total_quotes' => $prevQuotes,
                    'prev_conversion_rate' => $prevConversionRate,
                ],
                'assets' => [
                    'total_equipments' => $totalEquipments,
                    'calibrations_due_30' => $calibrationsDue,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Analytics executiveSummary failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao carregar resumo executivo'], 500);
        }
    }

    /**
     * Tendências mensais (últimos 12 meses) — séries temporais cross-module.
     */
    /**
     * Previsão futura baseada em regressão linear simples.
     */
    public function forecast(Request $request): JsonResponse
    {
        try {
            $tenantId = $request->user()?->tenant_id;
            $metric = $request->input('metric', 'revenue'); // revenue, expenses, os_total
            $months = (int) $request->input('months', 3);

            // Buscar histórico (últimos 12 meses)
            $historical = $this->getHistoricalData($metric, $tenantId);
            
            if (count($historical) < 3) {
                return response()->json(['message' => 'Dados insuficientes para previsão (mínimo 3 meses)'], 422);
            }

            // Calcular Regressão Linear (y = mx + b)
            $n = count($historical);
            $xSum = 0;
            $ySum = 0;
            $xxSum = 0;
            $xySum = 0;

            // Mapear dados para x (0, 1, 2...) e y (valores)
            $values = array_values($historical);
            foreach ($values as $x => $y) {
                $xSum += $x;
                $ySum += $y;
                $xxSum += ($x * $x);
                $xySum += ($x * $y);
            }

            // Evitar divisão por zero
            $denominator = ($n * $xxSum) - ($xSum * $xSum);
            if ($denominator == 0) {
                 return response()->json(['message' => 'Não foi possível calcular a tendência linear'], 422);
            }

            $slope = (($n * $xySum) - ($xSum * $ySum)) / $denominator;
            $intercept = ($ySum - ($slope * $xSum)) / $n;

            // Gerar previsões
            $forecast = [];
            $lastDate = Carbon::parse(array_key_last($historical));
            
            for ($i = 1; $i <= $months; $i++) {
                $nextX = ($n - 1) + $i;
                $predicted = ($slope * $nextX) + $intercept;
                $date = $lastDate->copy()->addMonths($i)->format('Y-m');
                
                $forecast[] = [
                    'month' => $lastDate->copy()->addMonths($i)->format('M/y'),
                    'value' => max(0, round($predicted, 2)), // Não permitir valores negativos
                    'type' => 'forecast'
                ];
            }

            return response()->json([
                'metric' => $metric,
                'historical' => array_map(fn($k, $v) => [
                    'month' => Carbon::parse($k)->format('M/y'),
                    'value' => $v,
                    'type' => 'historical'
                ], array_keys($historical), $values),
                'forecast' => $forecast,
                'trend' => $slope > 0 ? 'up' : ($slope < 0 ? 'down' : 'neutral'),
                'accuracy' => 'medium' // Placeholder para futuro R² calculation
            ]);

        } catch (\Exception $e) {
            Log::error('Analytics forecast failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar previsão'], 500);
        }
    }

    /**
     * Detecção de anomalias (Z-Score > 2).
     */
    public function anomalies(Request $request): JsonResponse
    {
        try {
            $tenantId = $request->user()?->tenant_id;
            $metric = $request->input('metric', 'revenue');

            $data = $this->getHistoricalData($metric, $tenantId, 24); // Buscar 24 meses para melhor média
            
            if (count($data) < 6) {
                return response()->json(['anomalies' => [], 'message' => 'Dados insuficientes']);
            }

            // Calcular Média e Desvio Padrão
            $values = array_values($data);
            $mean = array_sum($values) / count($values);
            $variance = 0;
            foreach ($values as $v) {
                $variance += pow(($v - $mean), 2);
            }
            $stdDev = sqrt($variance / count($values));

            if ($stdDev == 0) {
                return response()->json(['anomalies' => []]);
            }

            $anomalies = [];
            foreach ($data as $date => $value) {
                $zScore = ($value - $mean) / $stdDev;
                
                if (abs($zScore) > 1.8) { // Threshold de sensibilidade (1.8 sigma)
                    $anomalies[] = [
                        'date' => Carbon::parse($date)->format('M/y'),
                        'value' => $value,
                        'z_score' => round($zScore, 2),
                        'severity' => abs($zScore) > 3 ? 'critical' : 'warning',
                        'type' => $zScore > 0 ? 'high' : 'low',
                        'message' => $zScore > 0 
                            ? "Valor acima do normal (" . round($zScore, 1) . "x desvio)" 
                            : "Valor abaixo do normal (" . round($zScore, 1) . "x desvio)"
                    ];
                }
            }

            return response()->json([
                'metric' => $metric,
                'anomalies' => array_reverse($anomalies), // Mais recentes primeiro
                'stats' => [
                    'mean' => round($mean, 2),
                    'std_dev' => round($stdDev, 2)
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Analytics anomalies failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao detectar anomalias'], 500);
        }
    }

    /**
     * Motor de busca em linguagem natural (Simulado via Regex/Patterns).
     */
    public function nlQuery(Request $request): JsonResponse
    {
        try {
            $query = strtolower($request->input('query'));
            $tenantId = $request->user()?->tenant_id;

            // 1. Interpretar Intenção
            $intent = 'unknown';
            $metric = null;
            $period = 'current_month';

            if (preg_match('/(vendas|receita|faturamento|ganhos)/', $query)) {
                $metric = 'revenue';
                $intent = 'kpi';
            } elseif (preg_match('/(despesas|gastos|custos|pagar)/', $query)) {
                $metric = 'expenses';
                $intent = 'kpi';
            } elseif (preg_match('/(lucro|resultado|saldo|liquido)/', $query)) {
                $metric = 'profit';
                $intent = 'kpi';
            } elseif (preg_match('/(os|chamados|serviços|ordens)/', $query)) {
                $metric = 'work_orders';
                $intent = 'kpi';
            } elseif (preg_match('/(clientes|novos)/', $query)) {
                $metric = 'new_customers';
                $intent = 'kpi';
            }

            // 2. Interpretar Período
            if (preg_match('/(passado|anterior|ultimo mes)/', $query)) {
                $period = 'last_month';
            } elseif (preg_match('/(ano|anual|este ano)/', $query)) {
                $period = 'this_year';
            } elseif (preg_match('/(hoje|dia)/', $query)) {
                $period = 'today';
            }

            if ($intent === 'unknown') {
                return response()->json([
                    'answer' => "Desculpe, não entendi sua pergunta. Tente perguntar sobre 'receita', 'despesas', 'lucro' ou 'OS'.",
                    'type' => 'text'
                ]);
            }

            // 3. Executar Consulta
            $val = 0;
            $startDate = Carbon::now()->startOfMonth();
            $endDate = Carbon::now()->endOfMonth();
            $label = "este mês";

            if ($period === 'last_month') {
                $startDate = Carbon::now()->subMonth()->startOfMonth();
                $endDate = Carbon::now()->subMonth()->endOfMonth();
                $label = "mês passado";
            } elseif ($period === 'this_year') {
                $startDate = Carbon::now()->startOfYear();
                $endDate = Carbon::now()->endOfYear();
                $label = "este ano";
            } elseif ($period === 'today') {
                $startDate = Carbon::now()->startOfDay();
                $endDate = Carbon::now()->endOfDay();
                $label = "hoje";
            }

            switch ($metric) {
                case 'revenue':
                    $val = AccountReceivable::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                        ->whereBetween('due_date', [$startDate, $endDate])
                        ->where('status', 'paid')
                        ->sum('amount');
                    $formatted = 'R$ ' . number_format($val, 2, ',', '.');
                    $text = "A receita total {$label} foi de **{$formatted}**.";
                    break;

                case 'expenses':
                    $val = Expense::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                        ->whereBetween('expense_date', [$startDate, $endDate])
                        ->where('status', 'approved')
                        ->sum('amount');
                    $formatted = 'R$ ' . number_format($val, 2, ',', '.');
                    $text = "As despesas aprovadas {$label} totalizaram **{$formatted}**.";
                    break;
                
                case 'profit':
                    $rev = AccountReceivable::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                        ->whereBetween('due_date', [$startDate, $endDate])->where('status', 'paid')->sum('amount');
                    $exp = Expense::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                        ->whereBetween('expense_date', [$startDate, $endDate])->where('status', 'approved')->sum('amount');
                    $val = $rev - $exp;
                    $formatted = 'R$ ' . number_format($val, 2, ',', '.');
                    $text = "O lucro líquido estimativo {$label} foi de **{$formatted}**.";
                    break;

                case 'work_orders':
                    $val = WorkOrder::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                        ->whereBetween('created_at', [$startDate, $endDate])
                        ->count();
                    $text = "Foram criadas **{$val}** Ordens de Serviço {$label}.";
                    break;

                case 'new_customers':
                    $val = Customer::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                        ->whereBetween('created_at', [$startDate, $endDate])
                        ->count();
                    $text = "Conquistamos **{$val}** novos clientes {$label}.";
                    break;
            }

            return response()->json([
                'answer' => $text,
                'query_analysis' => ['metric' => $metric, 'period' => $period, 'intent' => $intent],
                'value' => $val,
                'type' => 'kpi_result'
            ]);

        } catch (\Exception $e) {
            Log::error('Analytics nlQuery failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao processar pergunta'], 500);
        }
    }

    /**
     * Helper para buscar dados históricos genéricos.
     */
    private function getHistoricalData(string $metric, ?string $tenantId, int $months = 12): array
    {
        $startDate = Carbon::now()->subMonths($months - 1)->startOfMonth();
        $data = [];

        if ($metric === 'revenue') {
            $data = AccountReceivable::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->where('due_date', '>=', $startDate)
                ->where('status', 'paid')
                ->select(DB::raw("DATE_FORMAT(due_date, '%Y-%m-01') as month"), DB::raw('SUM(amount) as value'))
                ->groupBy('month')->pluck('value', 'month')->toArray();
        } elseif ($metric === 'expenses') {
            $data = Expense::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->where('expense_date', '>=', $startDate)
                ->where('status', 'approved')
                ->select(DB::raw("DATE_FORMAT(expense_date, '%Y-%m-01') as month"), DB::raw('SUM(amount) as value'))
                ->groupBy('month')->pluck('value', 'month')->toArray();
        } elseif ($metric === 'os_total') {
            $data = WorkOrder::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
                ->where('created_at', '>=', $startDate)
                ->select(DB::raw("DATE_FORMAT(created_at, '%Y-%m-01') as month"), DB::raw('COUNT(*) as value'))
                ->groupBy('month')->pluck('value', 'month')->toArray();
        }

        // Preencher buracos com 0
        $filled = [];
        $current = $startDate->copy();
        while ($current->lte(Carbon::now()->startOfMonth())) {
            $key = $current->format('Y-m-01');
            $filled[$key] = isset($data[$key]) ? (float)$data[$key] : 0;
            $current->addMonth();
        }

        return $filled;
    }
}
