<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\Expense;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

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

    private function validateCashFlowRequest(Request $request): ?JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'months' => ['nullable', 'integer', 'min:1', 'max:36'],
            'os_number' => ['nullable', 'string', 'max:100'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Parametros invalidos para fluxo de caixa.',
                'errors' => $validator->errors(),
            ], 422);
        }

        return null;
    }

    private function validateDreRequest(Request $request): ?JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'os_number' => ['nullable', 'string', 'max:100'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Parametros invalidos para DRE.',
                'errors' => $validator->errors(),
            ], 422);
        }

        return null;
    }

    private function applyReceivableOsFilter(Builder $query, ?string $osNumber): void
    {
        if (!$osNumber) {
            return;
        }

        $query->whereHas('workOrder', function (Builder $woQuery) use ($osNumber) {
            $woQuery->where(function (Builder $whereQuery) use ($osNumber) {
                $whereQuery->where('os_number', 'like', "%{$osNumber}%")
                    ->orWhere('number', 'like', "%{$osNumber}%");
            });
        });
    }

    private function applyExpenseOsFilter(Builder $query, ?string $osNumber): void
    {
        if (!$osNumber) {
            return;
        }

        $query->whereHas('workOrder', function (Builder $woQuery) use ($osNumber) {
            $woQuery->where(function (Builder $whereQuery) use ($osNumber) {
                $whereQuery->where('os_number', 'like', "%{$osNumber}%")
                    ->orWhere('number', 'like', "%{$osNumber}%");
            });
        });
    }

    private function applyPayableIdentifierFilter(Builder $query, ?string $osNumber): void
    {
        if (!$osNumber) {
            return;
        }

        $query->where(function (Builder $whereQuery) use ($osNumber) {
            $whereQuery->where('description', 'like', "%{$osNumber}%")
                ->orWhere('notes', 'like', "%{$osNumber}%");
        });
    }

    private function applyPaymentOsFilter(Builder $query, string $payableType, ?string $osNumber): void
    {
        if (!$osNumber) {
            return;
        }

        if ($payableType === AccountReceivable::class) {
            $query->whereHasMorph('payable', [AccountReceivable::class], function (Builder $payableQuery) use ($osNumber) {
                $this->applyReceivableOsFilter($payableQuery, $osNumber);
            });
            return;
        }

        $query->whereHasMorph('payable', [AccountPayable::class], function (Builder $payableQuery) use ($osNumber) {
            $this->applyPayableIdentifierFilter($payableQuery, $osNumber);
        });
    }

    private function legacyPaidAmountWithoutPayments(
        int $tenantId,
        string $payableType,
        \Carbon\CarbonInterface $from,
        \Carbon\CarbonInterface $to,
        ?string $osNumber
    ): float {
        if ($payableType === AccountReceivable::class) {
            $query = AccountReceivable::query()
                ->where('tenant_id', $tenantId)
                ->where('status', AccountReceivable::STATUS_PAID)
                ->whereNotNull('paid_at')
                ->whereBetween('paid_at', [$from, $to])
                ->whereDoesntHave('payments');
            $this->applyReceivableOsFilter($query, $osNumber);
            return (float) $query->sum('amount');
        }

        $query = AccountPayable::query()
            ->where('tenant_id', $tenantId)
            ->where('status', AccountPayable::STATUS_PAID)
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$from, $to])
            ->whereDoesntHave('payments');
        $this->applyPayableIdentifierFilter($query, $osNumber);
        return (float) $query->sum('amount');
    }

    private function paidAmountInPeriod(
        int $tenantId,
        string $payableType,
        \Carbon\CarbonInterface $from,
        \Carbon\CarbonInterface $to,
        ?string $osNumber
    ): float {
        $paymentsQuery = Payment::query()
            ->where('tenant_id', $tenantId)
            ->where('payable_type', $payableType)
            ->whereBetween('payment_date', [$from, $to]);
        $this->applyPaymentOsFilter($paymentsQuery, $payableType, $osNumber);

        $paymentsAmount = (float) $paymentsQuery->sum('amount');
        $legacyAmount = $this->legacyPaidAmountWithoutPayments($tenantId, $payableType, $from, $to, $osNumber);

        return $paymentsAmount + $legacyAmount;
    }

    private function monthlyPaidTotals(
        int $tenantId,
        string $payableType,
        \Carbon\CarbonInterface $start,
        ?string $osNumber
    ): array {
        $periodExprPaymentDate = $this->periodExpression('payment_date');
        $paymentsQuery = Payment::query()
            ->select(DB::raw("{$periodExprPaymentDate} as month"), DB::raw('SUM(amount) as total'))
            ->where('tenant_id', $tenantId)
            ->where('payable_type', $payableType)
            ->where('payment_date', '>=', $start);
        $this->applyPaymentOsFilter($paymentsQuery, $payableType, $osNumber);

        $paymentsByMonth = $paymentsQuery
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $periodExprPaidAt = $this->periodExpression('paid_at');

        if ($payableType === AccountReceivable::class) {
            $legacyQuery = AccountReceivable::query()
                ->select(DB::raw("{$periodExprPaidAt} as month"), DB::raw('SUM(amount) as total'))
                ->where('tenant_id', $tenantId)
                ->where('status', AccountReceivable::STATUS_PAID)
                ->whereNotNull('paid_at')
                ->where('paid_at', '>=', $start)
                ->whereDoesntHave('payments');
            $this->applyReceivableOsFilter($legacyQuery, $osNumber);
        } else {
            $legacyQuery = AccountPayable::query()
                ->select(DB::raw("{$periodExprPaidAt} as month"), DB::raw('SUM(amount) as total'))
                ->where('tenant_id', $tenantId)
                ->where('status', AccountPayable::STATUS_PAID)
                ->whereNotNull('paid_at')
                ->where('paid_at', '>=', $start)
                ->whereDoesntHave('payments');
            $this->applyPayableIdentifierFilter($legacyQuery, $osNumber);
        }

        $legacyByMonth = $legacyQuery
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $result = [];
        foreach ($paymentsByMonth as $month => $row) {
            $result[(string) $month] = (float) ($row->total ?? 0);
        }
        foreach ($legacyByMonth as $month => $row) {
            $key = (string) $month;
            $result[$key] = (float) ($result[$key] ?? 0) + (float) ($row->total ?? 0);
        }

        return $result;
    }

    public function cashFlow(Request $request): JsonResponse
    {
        try {
            $validationError = $this->validateCashFlowRequest($request);
            if ($validationError) {
                return $validationError;
            }

            $tenantId = $this->tenantId($request);
            $osNumber = $this->osNumberFilter($request);
            $months = (int) ($request->get('months', 12));
            $start = now()->subMonths($months - 1)->startOfMonth();
            $periodExprDueDate = $this->periodExpression('due_date');
            $periodExprExpenseDate = $this->periodExpression('expense_date');

            $receivablesQuery = AccountReceivable::query()
                ->select(
                    DB::raw("{$periodExprDueDate} as month"),
                    DB::raw('SUM(amount) as total')
                )
                ->where('tenant_id', $tenantId)
                ->where('due_date', '>=', $start);
            $this->applyReceivableOsFilter($receivablesQuery, $osNumber);
            $receivables = $receivablesQuery
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->keyBy('month');

            $payablesQuery = AccountPayable::query()
                ->select(
                    DB::raw("{$periodExprDueDate} as month"),
                    DB::raw('SUM(amount) as total')
                )
                ->where('tenant_id', $tenantId)
                ->where('due_date', '>=', $start);
            $this->applyPayableIdentifierFilter($payablesQuery, $osNumber);
            $payables = $payablesQuery
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->keyBy('month');

            $expensesQuery = Expense::query()
                ->select(
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

            $receivablesPaidByMonth = $this->monthlyPaidTotals($tenantId, AccountReceivable::class, $start, $osNumber);
            $payablesPaidByMonth = $this->monthlyPaidTotals($tenantId, AccountPayable::class, $start, $osNumber);

            $data = [];
            $current = $start->copy();
            for ($i = 0; $i < $months; $i++) {
                $key = $current->format('Y-m');
                $rec = $receivables[$key] ?? null;
                $pay = $payables[$key] ?? null;
                $exp = $expenses[$key] ?? null;

                $receivablesTotal = (float) ($rec->total ?? 0);
                $payablesTotal = (float) ($pay->total ?? 0);
                $expensesTotal = (float) ($exp->total ?? 0);
                $receivablesPaid = (float) ($receivablesPaidByMonth[$key] ?? 0);
                $payablesPaid = (float) ($payablesPaidByMonth[$key] ?? 0);

                $data[] = [
                    'month' => $key,
                    'label' => $current->translatedFormat('M/Y'),
                    'receivables_total' => $receivablesTotal,
                    'receivables_paid' => $receivablesPaid,
                    'payables_total' => $payablesTotal,
                    'payables_paid' => $payablesPaid,
                    'expenses_total' => $expensesTotal,
                    'balance' => $receivablesTotal - ($payablesTotal + $expensesTotal),
                    'cash_balance' => $receivablesPaid - ($payablesPaid + $expensesTotal),
                ];
                $current->addMonth();
            }

            return response()->json($data);
        } catch (\Throwable $e) {
            Log::error('CashFlow failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar fluxo de caixa'], 500);
        }
    }

    public function dre(Request $request): JsonResponse
    {
        try {
            $validationError = $this->validateDreRequest($request);
            if ($validationError) {
                return $validationError;
            }

            $tenantId = $this->tenantId($request);
            $osNumber = $this->osNumberFilter($request);
            $from = $request->date('date_from') ?? now()->startOfMonth();
            $to = $request->date('date_to') ?? now()->endOfDay();

            if ($from->greaterThan($to)) {
                return response()->json(['message' => 'Data inicial nao pode ser posterior a data final'], 422);
            }

            $revenue = $this->paidAmountInPeriod($tenantId, AccountReceivable::class, $from, $to, $osNumber);
            $costs = $this->paidAmountInPeriod($tenantId, AccountPayable::class, $from, $to, $osNumber);

            $expensesQuery = Expense::query()
                ->where('tenant_id', $tenantId)
                ->where('status', Expense::STATUS_APPROVED)
                ->whereBetween('expense_date', [$from, $to]);
            $this->applyExpenseOsFilter($expensesQuery, $osNumber);
            $expenses = (float) $expensesQuery->sum('amount');

            $totalCosts = $costs + $expenses;

            $receivablesPendingQuery = AccountReceivable::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL]);
            $this->applyReceivableOsFilter($receivablesPendingQuery, $osNumber);
            $receivablesPending = (float) $receivablesPendingQuery->sum('amount');

            $payablesPendingQuery = AccountPayable::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_PARTIAL]);
            $this->applyPayableIdentifierFilter($payablesPendingQuery, $osNumber);
            $payablesPending = (float) $payablesPendingQuery->sum('amount');

            return response()->json([
                'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'os_number' => $osNumber],
                'revenue' => $revenue,
                'costs' => $costs,
                'expenses' => $expenses,
                'total_costs' => $totalCosts,
                'gross_profit' => $revenue - $totalCosts,
                'receivables_pending' => $receivablesPending,
                'payables_pending' => $payablesPending,
                'net_balance' => $revenue - $totalCosts + $receivablesPending - $payablesPending,
            ]);
        } catch (\Throwable $e) {
            Log::error('DRE failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar DRE'], 500);
        }
    }

    public function dreComparativo(Request $request): JsonResponse
    {
        try {
            $validationError = $this->validateDreRequest($request);
            if ($validationError) {
                return $validationError;
            }

            $tenantId = $this->tenantId($request);
            $osNumber = $this->osNumberFilter($request);
            $from = $request->date('date_from') ?? now()->startOfMonth();
            $to = $request->date('date_to') ?? now()->endOfDay();

            if ($from->greaterThan($to)) {
                return response()->json(['message' => 'Data inicial nao pode ser posterior a data final'], 422);
            }

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
        } catch (\Throwable $e) {
            Log::error('DRE Comparativo failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar DRE comparativo'], 500);
        }
    }

    private function calcDrePeriod(
        int $tenantId,
        \Carbon\CarbonInterface $from,
        \Carbon\CarbonInterface $to,
        ?string $osNumber = null
    ): array {
        $revenue = $this->paidAmountInPeriod($tenantId, AccountReceivable::class, $from, $to, $osNumber);
        $costs = $this->paidAmountInPeriod($tenantId, AccountPayable::class, $from, $to, $osNumber);

        $expensesQuery = Expense::query()
            ->where('tenant_id', $tenantId)
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
