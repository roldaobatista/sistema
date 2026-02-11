<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TechnicianCashFund;
use App\Models\TechnicianCashTransaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TechnicianCashController extends Controller
{
    private function tenantId(Request $request): int
    {
        return (int) ($request->user()->current_tenant_id ?? $request->user()->tenant_id);
    }

    /** Lista todos os fundos (saldos) dos tecnicos */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $funds = TechnicianCashFund::with('technician:id,name')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('balance')
            ->get();

        return response()->json($funds);
    }

    /** Detalhe de um fundo com extrato */
    public function show(int $userId, Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        // Validar que o usuario pertence ao tenant
        $userExists = User::where('id', $userId)
            ->where('tenant_id', $tenantId)
            ->exists();

        if (!$userExists) {
            return response()->json(['message' => 'Tecnico nao encontrado'], 404);
        }

        $fund = TechnicianCashFund::getOrCreate($userId, $tenantId);
        $fund->load('technician:id,name');

        $query = $fund->transactions()->with([
            'expense:id,description',
            'workOrder:id,number,os_number',
            'creator:id,name',
        ]);

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

    /** Adiciona credito (empresa disponibiliza verba) */
    public function addCredit(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'amount' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:255',
        ]);

        $fund = TechnicianCashFund::getOrCreate($validated['user_id'], $tenantId);
        $tx = $fund->addCredit(
            $validated['amount'],
            $validated['description'],
            $request->user()->id
        );

        return response()->json($tx->load('fund.technician:id,name'), 201);
    }

    /** Lanca debito manual (sem vinculo com despesa) */
    public function addDebit(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'amount' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:255',
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ]);

        $fund = TechnicianCashFund::getOrCreate($validated['user_id'], $tenantId);

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
    public function summary(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $funds = TechnicianCashFund::with('technician:id,name')
            ->where('tenant_id', $tenantId)
            ->get();

        $totalBalance = $funds->sum('balance');

        $monthCredits = TechnicianCashTransaction::where('tenant_id', $tenantId)
            ->where('type', TechnicianCashTransaction::TYPE_CREDIT)
            ->whereMonth('transaction_date', now()->month)
            ->whereYear('transaction_date', now()->year)
            ->sum('amount');

        $monthDebits = TechnicianCashTransaction::where('tenant_id', $tenantId)
            ->where('type', TechnicianCashTransaction::TYPE_DEBIT)
            ->whereMonth('transaction_date', now()->month)
            ->whereYear('transaction_date', now()->year)
            ->sum('amount');

        return response()->json([
            'total_balance' => round((float) $totalBalance, 2),
            'month_credits' => round((float) $monthCredits, 2),
            'month_debits' => round((float) $monthDebits, 2),
            'funds_count' => $funds->count(),
        ]);
    }
}

