<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TechnicianCashFund;
use App\Models\TechnicianCashTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TechnicianCashController extends Controller
{
    /** Lista todos os fundos (saldos) dos técnicos */
    public function index(): JsonResponse
    {
        $funds = TechnicianCashFund::with('technician:id,name')
            ->orderByDesc('balance')
            ->get();

        return response()->json($funds);
    }

    /** Detalhe de um fundo com extrato */
    public function show(int $userId, Request $request): JsonResponse
    {
        $fund = TechnicianCashFund::getOrCreate($userId, $request->user()->tenant_id);
        $fund->load('technician:id,name');

        $query = $fund->transactions()->with(['expense:id,description', 'workOrder:id,number', 'creator:id,name']);

        if ($from = $request->get('date_from')) {
            $query->where('transaction_date', '>=', $from);
        }
        if ($to = $request->get('date_to')) {
            $query->where('transaction_date', '<=', $to);
        }

        $transactions = $query->paginate($request->get('per_page', 30));

        return response()->json([
            'fund' => $fund,
            'transactions' => $transactions,
        ]);
    }

    /** Adiciona crédito (empresa disponibiliza verba) */
    public function addCredit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:255',
        ]);

        $fund = TechnicianCashFund::getOrCreate($validated['user_id'], $request->user()->tenant_id);
        $tx = $fund->addCredit(
            $validated['amount'],
            $validated['description'],
            $request->user()->id
        );

        return response()->json($tx->load('fund.technician:id,name'), 201);
    }

    /** Lança débito manual (sem vínculo com despesa) */
    public function addDebit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:255',
            'work_order_id' => 'nullable|exists:work_orders,id',
        ]);

        $fund = TechnicianCashFund::getOrCreate($validated['user_id'], $request->user()->tenant_id);
        $tx = $fund->addDebit(
            $validated['amount'],
            $validated['description'],
            null,
            $request->user()->id,
            $validated['work_order_id'] ?? null
        );

        return response()->json($tx->load('fund.technician:id,name'), 201);
    }

    /** Resumo geral */
    public function summary(): JsonResponse
    {
        $funds = TechnicianCashFund::with('technician:id,name')->get();

        $totalBalance = $funds->sum('balance');
        $monthCredits = TechnicianCashTransaction::where('type', 'credit')
            ->whereMonth('transaction_date', now()->month)
            ->whereYear('transaction_date', now()->year)
            ->sum('amount');
        $monthDebits = TechnicianCashTransaction::where('type', 'debit')
            ->whereMonth('transaction_date', now()->month)
            ->whereYear('transaction_date', now()->year)
            ->sum('amount');

        return response()->json([
            'total_balance' => (float) $totalBalance,
            'month_credits' => (float) $monthCredits,
            'month_debits' => (float) $monthDebits,
            'funds_count' => $funds->count(),
        ]);
    }
}
