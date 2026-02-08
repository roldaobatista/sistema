<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountReceivableController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AccountReceivable::with(['customer:id,name', 'workOrder:id,number']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"));
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
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'description' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'due_date' => 'required|date',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
        ]);

        $record = AccountReceivable::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($record->load(['customer:id,name']), 201);
    }

    public function show(AccountReceivable $accountReceivable): JsonResponse
    {
        return response()->json($accountReceivable->load([
            'customer:id,name,phone,email', 'workOrder:id,number',
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
            'status' => 'sometimes|in:pending,partial,paid,overdue,cancelled',
        ]);

        $accountReceivable->update($validated);
        return response()->json($accountReceivable->fresh()->load(['customer:id,name']));
    }

    public function destroy(AccountReceivable $accountReceivable): JsonResponse
    {
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

        $remaining = $accountReceivable->amount - $accountReceivable->amount_paid;
        if ($validated['amount'] > $remaining) {
            return response()->json(['message' => 'Valor excede o saldo restante (R$ ' . number_format($remaining, 2, ',', '.') . ')'], 422);
        }

        $payment = Payment::create([
            ...$validated,
            'payable_type' => AccountReceivable::class,
            'payable_id' => $accountReceivable->id,
            'received_by' => $request->user()->id,
        ]);

        return response()->json($payment->load('receiver:id,name'), 201);
    }

    // Gerar AR a partir de uma OS
    public function generateFromWorkOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'due_date' => 'required|date',
            'payment_method' => 'nullable|string|max:30',
        ]);

        $wo = \App\Models\WorkOrder::with('customer')->findOrFail($validated['work_order_id']);

        $exists = AccountReceivable::where('work_order_id', $wo->id)->exists();
        if ($exists) {
            return response()->json(['message' => 'Já existe título para esta OS'], 422);
        }

        $record = AccountReceivable::create([
            'customer_id' => $wo->customer_id,
            'work_order_id' => $wo->id,
            'created_by' => $request->user()->id,
            'description' => "OS {$wo->number}",
            'amount' => $wo->total,
            'due_date' => $validated['due_date'],
            'payment_method' => $validated['payment_method'] ?? null,
        ]);

        return response()->json($record->load(['customer:id,name', 'workOrder:id,number']), 201);
    }

    // Parcelamento — gera N títulos a partir de uma OS
    public function generateInstallments(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
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
                'customer_id' => $wo->customer_id,
                'work_order_id' => $wo->id,
                'created_by' => $request->user()->id,
                'description' => "OS {$wo->number} — Parcela " . ($i + 1) . "/{$n}",
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
        $pending = AccountReceivable::where('status', 'pending')->sum('amount');
        $overdue = AccountReceivable::where('status', 'overdue')->sum('amount');
        $paidMonth = AccountReceivable::where('status', 'paid')
            ->whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year)
            ->sum('amount');
        $total = AccountReceivable::whereNotIn('status', ['cancelled'])->sum('amount');

        return response()->json([
            'pending' => (float) $pending,
            'overdue' => (float) $overdue,
            'paid_this_month' => (float) $paidMonth,
            'total' => (float) $total,
        ]);
    }
}
