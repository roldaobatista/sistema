<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\Payment;
use App\Events\PaymentReceived;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountReceivableController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $query = AccountReceivable::with(['customer:id,name', 'workOrder:id,number,os_number'])
            ->where('tenant_id', $tenantId);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                  ->orWhereHas('workOrder', function ($wo) use ($search) {
                      $wo->where('number', 'like', "%{$search}%")
                         ->orWhere('os_number', 'like', "%{$search}%");
                  });
            });
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($from = $request->get('due_from')) {
            $query->where('due_date', '>=', $from);
        }

        if ($to = $request->get('due_to')) {
            $query->where('due_date', '<=', $to);
        }

        if ($customerId = $request->get('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        $records = $query->orderBy('due_date')
            ->paginate($request->get('per_page', 30));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'description' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'due_date' => 'required|date',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
        ]);

        $record = AccountReceivable::create([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($record->load(['customer:id,name', 'workOrder:id,number,os_number']), 201);
    }

    public function show(AccountReceivable $accountReceivable): JsonResponse
    {
        return response()->json($accountReceivable->load([
            'customer:id,name,phone,email', 'workOrder:id,number,os_number',
            'creator:id,name', 'payments.receiver:id,name',
        ]));
    }

    public function update(Request $request, AccountReceivable $accountReceivable): JsonResponse
    {
        $validated = $request->validate([
            'description' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0.01',
            'due_date' => 'sometimes|date',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
            'status' => ['sometimes', Rule::in(array_keys(AccountReceivable::STATUSES))],
        ]);

        $accountReceivable->update($validated);
        return response()->json($accountReceivable->fresh()->load(['customer:id,name', 'workOrder:id,number,os_number']));
    }

    public function destroy(AccountReceivable $accountReceivable): JsonResponse
    {
        if ($accountReceivable->payments()->exists()) {
            return response()->json([
                'message' => 'Não é possível excluir um título com pagamentos vinculados.',
            ], 422);
        }

        $accountReceivable->delete();
        return response()->json(null, 204);
    }

    // Registrar pagamento (baixa)
    public function pay(Request $request, AccountReceivable $accountReceivable): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|max:30',
            'payment_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        if ($accountReceivable->status === AccountReceivable::STATUS_CANCELLED) {
            return response()->json(['message' => 'Titulo cancelado nao pode receber baixa'], 422);
        }

        $remaining = $accountReceivable->amount - $accountReceivable->amount_paid;
        if ($remaining <= 0) {
            return response()->json(['message' => 'Titulo ja liquidado'], 422);
        }

        if ($validated['amount'] > $remaining) {
            return response()->json(['message' => 'Valor excede o saldo restante (R$ ' . number_format($remaining, 2, ',', '.') . ')'], 422);
        }

        $payment = null;
        try {
            $payment = Payment::create([
                ...$validated,
                'tenant_id' => $this->tenantId($request),
                'payable_type' => AccountReceivable::class,
                'payable_id' => $accountReceivable->id,
                'received_by' => $request->user()->id,
            ]);

            // amount_paid e status são atualizados automaticamente pelo Payment::booted()
            PaymentReceived::dispatch($accountReceivable->fresh(), $payment);

            return response()->json($payment->load('receiver:id,name'), 201);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao registrar pagamento: ' . $e->getMessage()], 500);
        }
    }

    // Gerar AR a partir de uma OS
    public function generateFromWorkOrder(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'work_order_id' => ['required', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'due_date' => 'required|date',
            'payment_method' => 'nullable|string|max:30',
        ]);

        $wo = \App\Models\WorkOrder::with('customer')->findOrFail($validated['work_order_id']);

        $exists = AccountReceivable::where('work_order_id', $wo->id)->exists();
        if ($exists) {
            return response()->json(['message' => 'Já existe título para esta OS'], 422);
        }

        try {
            $record = AccountReceivable::create([
                'tenant_id' => $tenantId,
                'customer_id' => $wo->customer_id,
                'work_order_id' => $wo->id,
                'created_by' => $request->user()->id,
                'description' => "OS {$wo->business_number}",
                'amount' => $wo->total,
                'due_date' => $validated['due_date'],
                'payment_method' => $validated['payment_method'] ?? null,
            ]);

            return response()->json($record->load(['customer:id,name', 'workOrder:id,number,os_number']), 201);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao gerar título a receber: ' . $e->getMessage()], 500);
        }
    }

    // Parcelamento — gera N títulos a partir de uma OS
    public function generateInstallments(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'work_order_id' => ['required', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'installments' => 'required|integer|min:2|max:48',
            'first_due_date' => 'required|date|after_or_equal:today',
            'payment_method' => 'nullable|string|max:30',
        ]);

        $wo = \App\Models\WorkOrder::with('customer')->findOrFail($validated['work_order_id']);

        $existing = AccountReceivable::where('work_order_id', $wo->id)->count();
        if ($existing) {
            return response()->json(['message' => 'Já existem títulos para esta OS'], 422);
        }

        $n = $validated['installments'];
        $installmentAmount = round($wo->total / $n, 2);
        $remainder = round($wo->total - ($installmentAmount * $n), 2);
        $records = [];

        for ($i = 0; $i < $n; $i++) {
            $amount = $installmentAmount + ($i === $n - 1 ? $remainder : 0);
            $records[] = AccountReceivable::create([
                'tenant_id' => $tenantId,
                'customer_id' => $wo->customer_id,
                'work_order_id' => $wo->id,
                'created_by' => $request->user()->id,
                'description' => "OS {$wo->business_number} — Parcela " . ($i + 1) . "/{$n}",
                'amount' => $amount,
                'due_date' => \Carbon\Carbon::parse($validated['first_due_date'])->addMonths($i),
                'payment_method' => $validated['payment_method'] ?? null,
            ]);
        }

        return response()->json($records, 201);
    }
    // Resumo financeiro
    public function summary(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $pending = (float) AccountReceivable::where('tenant_id', $tenantId)
            ->whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL])
            ->selectRaw('COALESCE(SUM(amount - amount_paid), 0) as total')
            ->value('total');

        $overdue = (float) AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', AccountReceivable::STATUS_OVERDUE)
            ->selectRaw('COALESCE(SUM(amount - amount_paid), 0) as total')
            ->value('total');

        $paidMonth = (float) Payment::where('tenant_id', $tenantId)
            ->where('payable_type', AccountReceivable::class)
            ->whereMonth('payment_date', now()->month)
            ->whereYear('payment_date', now()->year)
            ->sum('amount');

        $billedThisMonth = (float) AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', '!=', AccountReceivable::STATUS_CANCELLED)
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum('amount');

        $totalOpen = (float) AccountReceivable::where('tenant_id', $tenantId)
            ->whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL, AccountReceivable::STATUS_OVERDUE])
            ->selectRaw('COALESCE(SUM(amount - amount_paid), 0) as total')
            ->value('total');

        return response()->json([
            'pending' => $pending,
            'overdue' => $overdue,
            'billed_this_month' => $billedThisMonth,
            'paid_this_month' => $paidMonth,
            'total' => $totalOpen,
            'total_open' => $totalOpen,
        ]);
    }
}

