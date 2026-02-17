<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\WorkOrder;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class FinancialAnalyticsController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    /**
     * GET /financial/cash-flow-projection
     * Projects cash inflows/outflows for the next N months.
     */
    public function cashFlowProjection(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $months = min((int) $request->input('months', 6), 12);
        $startDate = Carbon::today();
        $projection = [];

        for ($i = 0; $i < $months; $i++) {
            $from = $startDate->copy()->addMonths($i)->startOfMonth();
            $to = $from->copy()->endOfMonth();

            $receivables = AccountReceivable::where('tenant_id', $tenantId)
                ->whereBetween('due_date', [$from, $to])
                ->whereNotIn('status', ['paid', 'cancelled'])
                ->selectRaw('COALESCE(SUM(amount - amount_paid), 0) as total, COUNT(*) as count')
                ->first();

            $payables = AccountPayable::where('tenant_id', $tenantId)
                ->whereBetween('due_date', [$from, $to])
                ->whereNotIn('status', ['paid', 'cancelled'])
                ->selectRaw('COALESCE(SUM(amount), 0) as total, COUNT(*) as count')
                ->first();

            $projection[] = [
                'month' => $from->format('Y-m'),
                'label' => $from->translatedFormat('M/Y'),
                'inflows' => (float) ($receivables->total ?? 0),
                'inflows_count' => (int) ($receivables->count ?? 0),
                'outflows' => (float) ($payables->total ?? 0),
                'outflows_count' => (int) ($payables->count ?? 0),
                'net' => (float) ($receivables->total ?? 0) - (float) ($payables->total ?? 0),
            ];
        }

        return response()->json(['data' => $projection]);
    }

    /**
     * GET /financial/dre
     * Income statement (DRE) for a given period.
     */
    public function dre(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $from = Carbon::parse($request->input('from', now()->startOfMonth()));
        $to = Carbon::parse($request->input('to', now()->endOfMonth()));

        // Revenue
        $revenue = AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->sum('amount');

        // COGS (custo dos serviços)
        $cogs = WorkOrder::where('tenant_id', $tenantId)
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->join('work_order_items', 'work_orders.id', '=', 'work_order_items.work_order_id')
            ->where('work_order_items.type', 'product')
            ->sum(DB::raw('work_order_items.quantity * work_order_items.unit_price'));

        // Operating expenses
        $expenses = AccountPayable::where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->sum('amount');

        // Expense breakdown by category
        $expensesByCategory = AccountPayable::where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->select('category', DB::raw('COALESCE(SUM(amount), 0) as total'))
            ->groupBy('category')
            ->orderByDesc('total')
            ->get();

        $grossProfit = (float) $revenue - (float) $cogs;
        $operatingProfit = $grossProfit - (float) $expenses;

        return response()->json([
            'data' => [
                'period' => ['from' => $from->format('Y-m-d'), 'to' => $to->format('Y-m-d')],
                'revenue' => round((float) $revenue, 2),
                'cogs' => round((float) $cogs, 2),
                'gross_profit' => round($grossProfit, 2),
                'gross_margin' => $revenue > 0 ? round(($grossProfit / $revenue) * 100, 1) : 0,
                'operating_expenses' => round((float) $expenses, 2),
                'operating_profit' => round($operatingProfit, 2),
                'operating_margin' => $revenue > 0 ? round(($operatingProfit / $revenue) * 100, 1) : 0,
                'expenses_by_category' => $expensesByCategory,
            ],
        ]);
    }

    /**
     * GET /financial/aging-report
     * Accounts receivable aging report (Relatório de Envelhecimento).
     */
    public function agingReport(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $today = Carbon::today();

        $receivables = AccountReceivable::where('tenant_id', $tenantId)
            ->whereNotIn('status', ['paid', 'cancelled'])
            ->with('customer:id,name')
            ->get();

        $buckets = [
            'current' => ['label' => 'A vencer', 'total' => 0, 'count' => 0, 'items' => []],
            '1_30' => ['label' => '1-30 dias', 'total' => 0, 'count' => 0, 'items' => []],
            '31_60' => ['label' => '31-60 dias', 'total' => 0, 'count' => 0, 'items' => []],
            '61_90' => ['label' => '61-90 dias', 'total' => 0, 'count' => 0, 'items' => []],
            'over_90' => ['label' => '> 90 dias', 'total' => 0, 'count' => 0, 'items' => []],
        ];

        $netAmountAccessor = function ($rec) {
            $amount = (float) $rec->amount;
            $paid = (float) $rec->amount_paid;
            return round($amount - $paid, 2);
        };

        foreach ($receivables as $rec) {
            $dueDate = Carbon::parse($rec->due_date);
            $daysOverdue = $today->diffInDays($dueDate, false);
            $netAmount = $netAmountAccessor($rec);

            $bucket = match (true) {
                $daysOverdue >= 0 => 'current',
                $daysOverdue >= -30 => '1_30',
                $daysOverdue >= -60 => '31_60',
                $daysOverdue >= -90 => '61_90',
                default => 'over_90',
            };

            $buckets[$bucket]['total'] += $netAmount;
            $buckets[$bucket]['count']++;
            $buckets[$bucket]['items'][] = [
                'id' => $rec->id,
                'customer_name' => $rec->customer->name ?? '',
                'description' => $rec->description ?? '',
                'amount' => round($netAmount, 2),
                'due_date' => $rec->due_date?->toDateString(),
                'days_overdue' => $daysOverdue < 0 ? (int) abs($daysOverdue) : 0,
            ];
        }

        $total = array_sum(array_column($buckets, 'total'));

        return response()->json([
            'data' => [
                'buckets' => $buckets,
                'total_outstanding' => round($total, 2),
                'total_overdue' => round($total - $buckets['current']['total'], 2),
                'total_records' => $receivables->count(),
            ],
        ]);
    }

    /**
     * GET /financial/expense-allocation
     * Expense allocation per work order.
     */
    public function expenseAllocation(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $from = Carbon::parse($request->input('from', now()->startOfMonth()));
        $to = Carbon::parse($request->input('to', now()->endOfMonth()));

        $query = DB::table('expenses')
            ->where('expenses.tenant_id', $tenantId)
            ->whereBetween('expenses.date', [$from, $to])
            ->whereNotNull('expenses.work_order_id')
            ->join('work_orders', 'expenses.work_order_id', '=', 'work_orders.id')
            ->leftJoin('customers', 'work_orders.customer_id', '=', 'customers.id')
            ->select(
                'work_orders.id as work_order_id',
                'work_orders.os_number',
                'customers.name as customer_name',
                DB::raw('COUNT(expenses.id) as expense_count'),
                DB::raw('COALESCE(SUM(expenses.amount), 0) as total_expenses'),
                'work_orders.total as work_order_total'
            )
            ->groupBy('work_orders.id', 'work_orders.os_number', 'customers.name', 'work_orders.total')
            ->orderByDesc('total_expenses');

        $allocations = $query->get()->map(function ($row) {
            $woTotal = (float) ($row->work_order_total ?? 0);
            $expTotal = (float) $row->total_expenses;
            return [
                'work_order_id' => $row->work_order_id,
                'os_number' => $row->os_number,
                'customer_name' => $row->customer_name,
                'expense_count' => $row->expense_count,
                'total_expenses' => round($expTotal, 2),
                'work_order_total' => round($woTotal, 2),
                'net_margin' => $woTotal > 0 ? round((($woTotal - $expTotal) / $woTotal) * 100, 1) : null,
            ];
        });

        return response()->json([
            'data' => $allocations,
            'summary' => [
                'total_expenses_allocated' => round($allocations->sum('total_expenses'), 2),
                'total_os_count' => $allocations->count(),
                'average_margin' => $allocations->avg('net_margin'),
            ],
        ]);
    }

    /**
     * GET /financial/batch-payment-approval
     * Lists payables pending batch approval.
     */
    public function batchPaymentApproval(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $query = AccountPayable::where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->with(['supplier:id,name']);

        if ($request->filled('due_before')) {
            $query->where('due_date', '<=', $request->input('due_before'));
        }

        if ($request->filled('min_amount')) {
            $query->where('amount', '>=', $request->input('min_amount'));
        }

        $perPage = min((int) $request->input('per_page', 30), 100);
        $payables = $query->orderBy('due_date')->paginate($perPage);

        return response()->json($payables);
    }

    /**
     * POST /financial/batch-payment-approval
     * Processes batch payment for multiple payables at once.
     */
    public function approveBatchPayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:accounts_payable,id',
            'payment_method' => 'nullable|string|max:30',
        ]);

        $tenantId = $this->tenantId();
        $paymentMethod = $validated['payment_method'] ?? 'transferencia';

        DB::beginTransaction();
        try {
            $payables = AccountPayable::where('tenant_id', $tenantId)
                ->whereIn('id', $validated['ids'])
                ->where('status', 'pending')
                ->get();

            $count = 0;
            foreach ($payables as $payable) {
                $remaining = round((float) $payable->amount - (float) $payable->amount_paid, 2);
                if ($remaining <= 0) {
                    continue;
                }

                \App\Models\Payment::create([
                    'tenant_id' => $tenantId,
                    'payable_type' => AccountPayable::class,
                    'payable_id' => $payable->id,
                    'received_by' => auth()->id(),
                    'amount' => $remaining,
                    'payment_method' => $paymentMethod,
                    'payment_date' => now()->toDateString(),
                    'notes' => 'Pagamento em lote',
                ]);

                $count++;
            }

            DB::commit();

            return response()->json([
                'message' => "{$count} pagamento(s) processado(s) com sucesso",
                'processed_count' => $count,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao processar pagamentos em lote'], 500);
        }
    }

    /**
     * GET /financial/cash-flow-weekly
     * Daily (or weekly) cash flow projection with running balance and health alerts.
     * Returns for each day: inflows, outflows, balance_projected, obligations_total, alert (shortage|tight|ok).
     */
    public function cashFlowWeekly(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $weeks = min(max((int) $request->input('weeks', 4), 1), 12);
        $from = Carbon::parse($request->input('from', now()->toDateString()));
        $to = $request->filled('to')
            ? Carbon::parse($request->input('to'))
            : $from->copy()->addWeeks($weeks)->subDay();
        $initialBalance = (float) $request->input('initial_balance', 0);
        $marginThreshold = (float) $request->input('margin_threshold', 0.15); // 15% margin = tight

        if ($to->lt($from)) {
            $to = $from->copy()->addWeeks($weeks)->subDay();
        }

        $days = [];
        $current = $from->copy();
        while ($current->lte($to)) {
            $days[] = $current->copy()->toDateString();
            $current->addDay();
        }

        $receivablesByDate = AccountReceivable::where('tenant_id', $tenantId)
            ->whereNotIn('status', ['paid', 'cancelled'])
            ->whereBetween('due_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('DATE(due_date) as d, COALESCE(SUM(amount - amount_paid), 0) as total')
            ->groupByRaw('DATE(due_date)')
            ->get()
            ->keyBy('d');

        $payablesByDate = AccountPayable::where('tenant_id', $tenantId)
            ->whereNotIn('status', ['paid', 'cancelled'])
            ->whereBetween('due_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('DATE(due_date) as d, COALESCE(SUM(amount - amount_paid), 0) as total')
            ->groupByRaw('DATE(due_date)')
            ->get()
            ->keyBy('d');

        $expensesByDate = Expense::where('tenant_id', $tenantId)
            ->where('status', Expense::STATUS_APPROVED)
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('DATE(expense_date) as d, COALESCE(SUM(amount), 0) as total')
            ->groupByRaw('DATE(expense_date)')
            ->get()
            ->keyBy('d');

        $result = [];
        $balance = $initialBalance;
        $today = Carbon::today()->toDateString();

        foreach ($days as $d) {
            $inflows = (float) ($receivablesByDate->get($d)?->total ?? 0);
            $outflowsPay = (float) ($payablesByDate->get($d)?->total ?? 0);
            $outflowsExp = (float) ($expensesByDate->get($d)?->total ?? 0);
            $outflows = $outflowsPay + $outflowsExp;
            $balance += $inflows - $outflows;
            $balance = round($balance, 2);

            $obligations = $outflows;
            $alert = 'ok';
            if ($obligations > 0) {
                if ($balance < $obligations) {
                    $alert = 'shortage';
                } elseif ($balance > 0) {
                    $margin = ($balance - $obligations) / $obligations;
                    if ($margin < $marginThreshold) {
                        $alert = 'tight';
                    }
                }
            }

            $result[] = [
                'date' => $d,
                'label' => Carbon::parse($d)->format('d/m'),
                'inflows' => round($inflows, 2),
                'outflows' => round($outflows, 2),
                'obligations_total' => round($obligations, 2),
                'balance_projected' => $balance,
                'alert' => $alert,
                'is_today' => $d === $today,
            ];
        }

        $shortageDays = array_filter($result, fn ($r) => $r['alert'] === 'shortage');
        $tightDays = array_filter($result, fn ($r) => $r['alert'] === 'tight');
        $minBalance = $result ? min(array_column($result, 'balance_projected')) : 0;
        $minBalanceDate = $result ? $result[array_search($minBalance, array_column($result, 'balance_projected'))]['date'] ?? null : null;

        return response()->json([
            'data' => [
                'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'initial_balance' => $initialBalance,
                'days' => $result,
                'summary' => [
                    'days_shortage' => count($shortageDays),
                    'days_tight' => count($tightDays),
                    'min_balance' => round($minBalance, 2),
                    'min_balance_date' => $minBalanceDate,
                ],
            ],
        ]);
    }
}
