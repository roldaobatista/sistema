<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CashFlowController extends Controller
{
    /**
     * Cash Flow — monthly grouped receivables vs payables
     */
    public function cashFlow(Request $request): JsonResponse
    {
        $months = (int) $request->get('months', 12);
        $start = now()->subMonths($months - 1)->startOfMonth();

        $receivables = AccountReceivable::select(
                DB::raw("DATE_FORMAT(due_date, '%Y-%m') as month"),
                DB::raw('SUM(amount) as total'),
                DB::raw('SUM(CASE WHEN status = "paid" THEN amount ELSE 0 END) as paid')
            )
            ->where('due_date', '>=', $start)
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $payables = AccountPayable::select(
                DB::raw("DATE_FORMAT(due_date, '%Y-%m') as month"),
                DB::raw('SUM(amount) as total'),
                DB::raw('SUM(CASE WHEN status = "paid" THEN amount ELSE 0 END) as paid')
            )
            ->where('due_date', '>=', $start)
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        // Despesas aprovadas agrupadas por mês
        $expenses = Expense::select(
                DB::raw("DATE_FORMAT(expense_date, '%Y-%m') as month"),
                DB::raw('SUM(amount) as total')
            )
            ->where('status', 'approved')
            ->where('expense_date', '>=', $start)
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
     * DRE — Demonstrativo de Resultado do Exercício
     */
    public function dre(Request $request): JsonResponse
    {
        $from = $request->date('date_from') ?? now()->startOfMonth();
        $to = $request->date('date_to') ?? now()->endOfDay();

        $revenue = AccountReceivable::where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->sum('amount');

        $costs = AccountPayable::where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->sum('amount');

        // Gap #11 — Incluir despesas aprovadas no DRE
        $expenses = Expense::where('status', 'approved')
            ->whereBetween('expense_date', [$from, $to])
            ->sum('amount');

        $totalCosts = (float) $costs + (float) $expenses;

        $receivablesPending = AccountReceivable::whereIn('status', ['pending', 'partial'])
            ->sum('amount');

        $payablesPending = AccountPayable::whereIn('status', ['pending', 'partial'])
            ->sum('amount');

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
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
}
