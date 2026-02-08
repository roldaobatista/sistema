<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountPayableController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AccountPayable::query();

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('supplier', 'like', "%{$search}%");
            });
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($category = $request->get('category')) {
            $query->where('category', $category);
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
        $validated = $request->validate([
            'supplier' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:50',
            'description' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'due_date' => 'required|date',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
        ]);

        $record = AccountPayable::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($record, 201);
    }

    public function show(AccountPayable $accountPayable): JsonResponse
    {
        return response()->json($accountPayable->load([
            'creator:id,name', 'payments.receiver:id,name',
        ]));
    }

    public function update(Request $request, AccountPayable $accountPayable): JsonResponse
    {
        $validated = $request->validate([
            'supplier' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:50',
            'description' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0.01',
            'due_date' => 'sometimes|date',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
            'status' => 'sometimes|in:pending,partial,paid,overdue,cancelled',
        ]);

        $accountPayable->update($validated);
        return response()->json($accountPayable->fresh());
    }

    public function destroy(AccountPayable $accountPayable): JsonResponse
    {
        $accountPayable->delete();
        return response()->json(null, 204);
    }

    public function pay(Request $request, AccountPayable $accountPayable): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|max:30',
            'payment_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        $remaining = $accountPayable->amount - $accountPayable->amount_paid;
        if ($validated['amount'] > $remaining) {
            return response()->json(['message' => 'Valor excede o saldo restante'], 422);
        }

        $payment = Payment::create([
            ...$validated,
            'payable_type' => AccountPayable::class,
            'payable_id' => $accountPayable->id,
            'received_by' => $request->user()->id,
        ]);

        return response()->json($payment->load('receiver:id,name'), 201);
    }

    public function summary(Request $request): JsonResponse
    {
        $pending = AccountPayable::where('status', 'pending')->sum('amount');
        $overdue = AccountPayable::where('status', 'overdue')->sum('amount');
        $paidMonth = AccountPayable::where('status', 'paid')
            ->whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year)
            ->sum('amount');

        return response()->json([
            'pending' => (float) $pending,
            'overdue' => (float) $overdue,
            'paid_this_month' => (float) $paidMonth,
        ]);
    }
}
