<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CashFlowController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    private function periodExpression(string $column): string
    {
        return DB::getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', {$column})"
            : "DATE_FORMAT({$column}, '%Y-%m')";
    }

    private function osNumberFilter(Request $request): ?string
    {
        $osNumber = trim((string) $request->get('os_number', ''));
        return $osNumber !== '' ? $osNumber : null;
    }

    private function applyReceivableOsFilter($query, ?string $osNumber): void
    {
        if (!$osNumber) {
            return;
        }

        $query->whereHas('workOrder', function ($wo) use ($osNumber) {
            $wo->where(function ($q) use ($osNumber) {
                $q->where('os_number', 'like', "%{$osNumber}%")
                    ->orWhere('number', 'like', "%{$osNumber}%");
            });
        });
    }

    private function applyExpenseOsFilter($query, ?string $osNumber): void
    {
        if (!$osNumber) {
            return;
        }

        $query->whereHas('workOrder', function ($wo) use ($osNumber) {
            $wo->where(function ($q) use ($osNumber) {
                $q->where('os_number', 'like', "%{$osNumber}%")
                    ->orWhere('number', 'like', "%{$osNumber}%");
            });
        });
    }

    private function applyPayableIdentifierFilter($query, ?string $osNumber): void
    {
        if (!$osNumber) {
            return;
        }

        $query->where(function ($q) use ($osNumber) {
            $q->where('description', 'like', "%{$osNumber}%")
                ->orWhere('notes', 'like', "%{$osNumber}%");
        });
    }

    /**
     * Cash Flow - monthly grouped receivables vs payables
     */
    public function cashFlow(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $osNumber = $this->osNumberFilter($request);
        $months = max(1, min(36, (int) $request->get('months', 12)));
        $start = now()->subMonths($months - 1)->startOfMonth();
        $periodExprDueDate = $this->periodExpression('due_date');
        $periodExprExpenseDate = $this->periodExpression('expense_date');

        $receivablesQuery = AccountReceivable::select(
            DB::raw("{$periodExprDueDate} as month"),
            DB::raw('SUM(amount) as total'),
            DB::raw('SUM(CASE WHEN status = "' . AccountReceivable::STATUS_PAID . '" THEN amount ELSE 0 END) as paid')
        )
            ->where('tenant_id', $tenantId)
            ->where('due_date', '>=', $start);
        $this->applyReceivableOsFilter($receivablesQuery, $osNumber);
        $receivables = $receivablesQuery
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $payablesQuery = AccountPayable::select(
            DB::raw("{$periodExprDueDate} as month"),
            DB::raw('SUM(amount) as total'),
            DB::raw('SUM(CASE WHEN status = "' . AccountPayable::STATUS_PAID . '" THEN amount ELSE 0 END) as paid')
        )
            ->where('tenant_id', $tenantId)
            ->where('due_date', '>=', $start);
        $this->applyPayableIdentifierFilter($payablesQuery, $osNumber);
        $payables = $payablesQuery
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $expensesQuery = Expense::select(
            DB::raw("{$periodExprExpenseDate} as month"),
            DB::raw('SUM(amount) as total')
        )
            ->where('tenant_id', $tenantId)
            ->where('status', Expense::STATUS_APPROVED)
            ->where('expense_date', '>=', $start);
        $this->applyExpenseOsFilter($expensesQuery, $osNumber);
        $expenses = $expensesQuery
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $data = [];
        $current = $start->copy();
        for ($i = 0; $i < $months; $i++) {
            $key = $current->format('Y-m');
            $rec = $receivables[$key] ?? null;
            $pay = $payables[$key] ?? null;
            $exp = $expenses[$key] ?? null;
            $totalOut = (float) ($pay->total ?? 0) + (float) ($exp->total ?? 0);
            $data[] = [
                'month' => $key,
                'label' => $current->translatedFormat('M/Y'),
                'receivables_total' => (float) ($rec->total ?? 0),
                'receivables_paid' => (float) ($rec->paid ?? 0),
                'payables_total' => (float) ($pay->total ?? 0),
                'payables_paid' => (float) ($pay->paid ?? 0),
                'expenses_total' => (float) ($exp->total ?? 0),
                'balance' => (float) ($rec->total ?? 0) - $totalOut,
            ];
            $current->addMonth();
        }

        return response()->json($data);
    }

    /**
     * DRE - income statement
     */
    public function dre(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $osNumber = $this->osNumberFilter($request);
        $from = $request->date('date_from') ?? now()->startOfMonth();
        $to = $request->date('date_to') ?? now()->endOfDay();

        $revenueQuery = AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', AccountReceivable::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to]);
        $this->applyReceivableOsFilter($revenueQuery, $osNumber);
        $revenue = $revenueQuery->sum('amount');

        $costsQuery = AccountPayable::where('tenant_id', $tenantId)
            ->where('status', AccountPayable::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to]);
        $this->applyPayableIdentifierFilter($costsQuery, $osNumber);
        $costs = $costsQuery->sum('amount');

        $expensesQuery = Expense::where('tenant_id', $tenantId)
            ->where('status', Expense::STATUS_APPROVED)
            ->whereBetween('expense_date', [$from, $to]);
        $this->applyExpenseOsFilter($expensesQuery, $osNumber);
        $expenses = $expensesQuery->sum('amount');

        $totalCosts = (float) $costs + (float) $expenses;

        $receivablesPendingQuery = AccountReceivable::where('tenant_id', $tenantId)
            ->whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL]);
        $this->applyReceivableOsFilter($receivablesPendingQuery, $osNumber);
        $receivablesPending = $receivablesPendingQuery->sum('amount');

        $payablesPendingQuery = AccountPayable::where('tenant_id', $tenantId)
            ->whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_PARTIAL]);
        $this->applyPayableIdentifierFilter($payablesPendingQuery, $osNumber);
        $payablesPending = $payablesPendingQuery->sum('amount');

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'os_number' => $osNumber],
            'revenue' => (float) $revenue,
            'costs' => (float) $costs,
            'expenses' => (float) $expenses,
            'total_costs' => $totalCosts,
            'gross_profit' => (float) $revenue - $totalCosts,
            'receivables_pending' => (float) $receivablesPending,
            'payables_pending' => (float) $payablesPending,
            'net_balance' => (float) $revenue - $totalCosts + (float) $receivablesPending - (float) $payablesPending,
        ]);
    }

    /**
     * Comparative DRE - current period vs previous period
     */
    public function dreComparativo(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $osNumber = $this->osNumberFilter($request);
        $from = $request->date('date_from') ?? now()->startOfMonth();
        $to = $request->date('date_to') ?? now()->endOfDay();
        $days = $from->diffInDays($to);

        $prevTo = $from->copy()->subDay();
        $prevFrom = $prevTo->copy()->subDays($days);

        $current = $this->calcDrePeriod($tenantId, $from, $to, $osNumber);
        $previous = $this->calcDrePeriod($tenantId, $prevFrom, $prevTo, $osNumber);

        $variation = fn ($cur, $prev) => $prev > 0 ? round((($cur - $prev) / $prev) * 100, 1) : ($cur > 0 ? 100 : 0);

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'os_number' => $osNumber],
            'current' => $current,
            'previous' => $previous,
            'variation' => [
                'revenue' => $variation($current['revenue'], $previous['revenue']),
                'total_costs' => $variation($current['total_costs'], $previous['total_costs']),
                'gross_profit' => $variation($current['gross_profit'], $previous['gross_profit']),
            ],
        ]);
    }

    private function calcDrePeriod(int $tenantId, $from, $to, ?string $osNumber = null): array
    {
        $revenueQuery = AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', AccountReceivable::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to]);
        $this->applyReceivableOsFilter($revenueQuery, $osNumber);
        $revenue = (float) $revenueQuery->sum('amount');

        $costsQuery = AccountPayable::where('tenant_id', $tenantId)
            ->where('status', AccountPayable::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to]);
        $this->applyPayableIdentifierFilter($costsQuery, $osNumber);
        $costs = (float) $costsQuery->sum('amount');

        $expensesQuery = Expense::where('tenant_id', $tenantId)
            ->where('status', Expense::STATUS_APPROVED)
            ->whereBetween('expense_date', [$from, $to]);
        $this->applyExpenseOsFilter($expensesQuery, $osNumber);
        $expenses = (float) $expensesQuery->sum('amount');
        $totalCosts = $costs + $expenses;

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'revenue' => $revenue,
            'costs' => $costs,
            'expenses' => $expenses,
            'total_costs' => $totalCosts,
            'gross_profit' => $revenue - $totalCosts,
        ];
    }
}
