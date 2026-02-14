<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Events\PaymentMade;
use App\Models\AccountPayable;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class AccountPayableController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $query = AccountPayable::query()
            ->where('tenant_id', $tenantId)
            ->with(['supplierRelation:id,name', 'categoryRelation:id,name,color', 'chartOfAccount:id,code,name,type', 'creator:id,name']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhereHas('supplierRelation', fn ($sq) => $sq->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($category = $request->get('category')) {
            $query->where('category_id', $category);
        }

        if ($from = $request->get('due_from')) {
            $query->where('due_date', '>=', $from);
        }

        if ($to = $request->get('due_to')) {
            $query->where('due_date', '<=', $to);
        }

        $records = $query->orderBy('due_date')
            ->paginate($request->get('per_page', 30));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'supplier_id' => ['nullable', Rule::exists('suppliers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'category_id' => ['nullable', Rule::exists('account_payable_categories', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'chart_of_account_id' => ['nullable', Rule::exists('chart_of_accounts', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'description' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'due_date' => 'required|date',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
        ]);

        try {
            $record = DB::transaction(function () use ($validated, $tenantId, $request) {
                return AccountPayable::create([
                    ...$validated,
                    'tenant_id' => $tenantId,
                    'created_by' => $request->user()->id,
                ]);
            });

            return response()->json($record->refresh()->load(['supplierRelation:id,name', 'categoryRelation:id,name,color', 'chartOfAccount:id,code,name,type', 'creator:id,name']), 201);
        } catch (\Throwable $e) {
            Log::error('AP store failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao criar título a pagar'], 500);
        }
    }

    public function show(AccountPayable $accountPayable): JsonResponse
    {
        return response()->json($accountPayable->load([
            'supplierRelation:id,name',
            'categoryRelation:id,name,color',
            'chartOfAccount:id,code,name,type',
            'creator:id,name',
            'payments.receiver:id,name',
        ]));
    }

    public function update(Request $request, AccountPayable $accountPayable): JsonResponse
    {
        if (in_array($accountPayable->status, [AccountPayable::STATUS_CANCELLED, AccountPayable::STATUS_PAID])) {
            return response()->json(['message' => 'Título cancelado ou pago não pode ser editado'], 422);
        }

        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'supplier_id' => ['nullable', Rule::exists('suppliers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'category_id' => ['nullable', Rule::exists('account_payable_categories', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'chart_of_account_id' => ['nullable', Rule::exists('chart_of_accounts', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'description' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0.01',
            'due_date' => 'sometimes|date',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
            'status' => ['sometimes', Rule::in(array_keys(AccountPayable::STATUSES))],
        ]);

        // Block amount change below already paid
        if (isset($validated['amount']) && $accountPayable->payments()->exists()) {
            if (bccomp((string) $validated['amount'], (string) $accountPayable->amount_paid, 2) < 0) {
                return response()->json(['message' => 'O valor não pode ser menor que o já pago (R$ ' . number_format((float) $accountPayable->amount_paid, 2, ',', '.') . ')'], 422);
            }
        }

        try {
            $accountPayable->update($validated);

            if (isset($validated['amount'])) {
                $accountPayable->recalculateStatus();
            }

            return response()->json($accountPayable->fresh()->load(['supplierRelation:id,name', 'categoryRelation:id,name,color', 'chartOfAccount:id,code,name,type']));
        } catch (\Throwable $e) {
            Log::error('AP update failed', ['id' => $accountPayable->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar título'], 500);
        }
    }

    public function destroy(AccountPayable $accountPayable): JsonResponse
    {
        if ($accountPayable->payments()->exists()) {
            return response()->json(['message' => 'Não é possível excluir título com pagamentos vinculados'], 409);
        }

        try {
            DB::transaction(fn () => $accountPayable->delete());
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('AP destroy failed', ['id' => $accountPayable->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir título'], 500);
        }
    }

    public function pay(Request $request, AccountPayable $accountPayable): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|max:30',
            'payment_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        if ($accountPayable->status === AccountPayable::STATUS_CANCELLED) {
            return response()->json(['message' => 'Título cancelado não pode receber baixa'], 422);
        }

        $remaining = bcsub((string) $accountPayable->amount, (string) $accountPayable->amount_paid, 2);
        if (bccomp($remaining, '0', 2) <= 0) {
            return response()->json(['message' => 'Título já liquidado'], 422);
        }

        if (bccomp((string) $validated['amount'], $remaining, 2) > 0) {
            return response()->json(['message' => 'Valor excede o saldo restante (R$ ' . number_format((float) $remaining, 2, ',', '.') . ')'], 422);
        }

        try {
            $payment = DB::transaction(function () use ($validated, $request, $accountPayable) {
                return Payment::create([
                    ...$validated,
                    'tenant_id' => $this->tenantId($request),
                    'payable_type' => AccountPayable::class,
                    'payable_id' => $accountPayable->id,
                    'received_by' => $request->user()->id,
                ]);
                // amount_paid e status são atualizados automaticamente pelo Payment::booted()
            });

            PaymentMade::dispatch($accountPayable->fresh(), $payment);

            return response()->json($payment->load('receiver:id,name'), 201);
        } catch (\Throwable $e) {
            Log::error('AP pay failed', ['id' => $accountPayable->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao registrar pagamento'], 500);
        }
    }

    public function summary(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $pending = (float) AccountPayable::where('tenant_id', $tenantId)
                ->whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_PARTIAL])
                ->selectRaw('COALESCE(SUM(amount - amount_paid), 0) as total')
                ->value('total');

            $overdue = (float) AccountPayable::where('tenant_id', $tenantId)
                ->where('status', AccountPayable::STATUS_OVERDUE)
                ->selectRaw('COALESCE(SUM(amount - amount_paid), 0) as total')
                ->value('total');

            $paidMonth = (float) Payment::where('tenant_id', $tenantId)
                ->where('payable_type', AccountPayable::class)
                ->whereMonth('payment_date', now()->month)
                ->whereYear('payment_date', now()->year)
                ->sum('amount');

            $recordedThisMonth = (float) AccountPayable::where('tenant_id', $tenantId)
                ->whereNotIn('status', [AccountPayable::STATUS_CANCELLED])
                ->whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->sum('amount');

            $totalOpen = (float) AccountPayable::where('tenant_id', $tenantId)
                ->whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_PARTIAL, AccountPayable::STATUS_OVERDUE])
                ->selectRaw('COALESCE(SUM(amount - amount_paid), 0) as total')
                ->value('total');

            return response()->json([
                'pending' => $pending,
                'overdue' => $overdue,
                'recorded_this_month' => $recordedThisMonth,
                'paid_this_month' => $paidMonth,
                'total_open' => $totalOpen,
            ]);
        } catch (\Throwable $e) {
            Log::error('AP summary failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar resumo'], 500);
        }
    }
}
