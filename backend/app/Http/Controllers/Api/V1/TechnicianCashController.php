<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TechnicianCashFund;
use App\Models\TechnicianCashTransaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TechnicianCashController extends Controller
{
    private function tenantId(Request $request): int
    {
        return (int) ($request->user()->current_tenant_id ?? $request->user()->tenant_id);
    }

    private function userBelongsToTenant(int $userId, int $tenantId): bool
    {
        return User::query()
            ->where('id', $userId)
            ->where(function ($query) use ($tenantId) {
                $query
                    ->where('tenant_id', $tenantId)
                    ->orWhere('current_tenant_id', $tenantId)
                    ->orWhereHas('tenants', fn ($tenantQuery) => $tenantQuery->where('tenants.id', $tenantId));
            })
            ->exists();
    }

    private function ensureTenantUser(int $userId, int $tenantId, string $field = 'user_id'): void
    {
        if (!$this->userBelongsToTenant($userId, $tenantId)) {
            throw ValidationException::withMessages([
                $field => ['Tecnico nao pertence ao tenant atual.'],
            ]);
        }
    }

    /** Lista todos os fundos (saldos) dos tecnicos */
    public function index(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $funds = TechnicianCashFund::with('technician:id,name')
                ->where('tenant_id', $tenantId)
                ->orderByDesc('balance')
                ->get();

            return response()->json($funds);
        } catch (\Exception $e) {
            Log::error('TechnicianCash index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar caixa dos tecnicos'], 500);
        }
    }

    /** Detalhe de um fundo com extrato */
    public function show(int $userId, Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            if (!$this->userBelongsToTenant($userId, $tenantId)) {
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
        } catch (\Exception $e) {
            Log::error('TechnicianCash show failed', ['error' => $e->getMessage(), 'user_id' => $userId]);
            return response()->json(['message' => 'Erro ao buscar caixa do tecnico'], 500);
        }
    }

    /** Adiciona credito (empresa disponibiliza verba) */
    public function addCredit(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $validated = $request->validate([
                'user_id' => ['required', Rule::exists('users', 'id')],
                'amount' => 'required|numeric|min:0.01',
                'description' => 'required|string|max:255',
                'payment_method' => ['sometimes', Rule::in(['cash', 'corporate_card'])],
            ]);
            $this->ensureTenantUser((int) $validated['user_id'], $tenantId);

            DB::beginTransaction();
            $fund = TechnicianCashFund::getOrCreate($validated['user_id'], $tenantId);
            $tx = $fund->addCredit(
                $validated['amount'],
                $validated['description'],
                $request->user()->id,
                null,
                $validated['payment_method'] ?? 'cash'
            );
            DB::commit();

            return response()->json($tx->load('fund.technician:id,name'), 201);
        } catch (ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Dados invalidos', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('TechnicianCash addCredit failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao adicionar credito'], 500);
        }
    }

    /** Lanca debito manual (sem vinculo com despesa) */
    public function addDebit(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $validated = $request->validate([
                'user_id' => ['required', Rule::exists('users', 'id')],
                'amount' => 'required|numeric|min:0.01',
                'description' => 'required|string|max:255',
                'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
                'payment_method' => ['sometimes', Rule::in(['cash', 'corporate_card'])],
            ]);
            $this->ensureTenantUser((int) $validated['user_id'], $tenantId);

            DB::beginTransaction();
            $fund = TechnicianCashFund::getOrCreate($validated['user_id'], $tenantId);

            $tx = $fund->addDebit(
                $validated['amount'],
                $validated['description'],
                null,
                $request->user()->id,
                $validated['work_order_id'] ?? null,
                false,
                $validated['payment_method'] ?? 'cash'
            );
            DB::commit();

            return response()->json($tx->load('fund.technician:id,name'), 201);
        } catch (ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Dados invalidos', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('TechnicianCash addDebit failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao lancar debito'], 500);
        }
    }

    /** Resumo geral */
    public function summary(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $funds = TechnicianCashFund::with('technician:id,name')
                ->where('tenant_id', $tenantId)
                ->get();

            $totalBalance = $funds->sum('balance');
            $totalCardBalance = $funds->sum('card_balance');

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
                'total_card_balance' => round((float) $totalCardBalance, 2),
                'month_credits' => round((float) $monthCredits, 2),
                'month_debits' => round((float) $monthDebits, 2),
                'funds_count' => $funds->count(),
            ]);
        } catch (\Exception $e) {
            Log::error('TechnicianCash summary failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao calcular resumo'], 500);
        }
    }
}
