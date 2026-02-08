<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Expense::with(['category:id,name,color', 'creator:id,name', 'workOrder:id,number']);

        if ($search = $request->get('search')) {
            $query->where('description', 'like', "%{$search}%");
        }
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }
        if ($catId = $request->get('expense_category_id')) {
            $query->where('expense_category_id', $catId);
        }
        if ($userId = $request->get('created_by')) {
            $query->where('created_by', $userId);
        }
        if ($from = $request->get('date_from')) {
            $query->where('expense_date', '>=', $from);
        }
        if ($to = $request->get('date_to')) {
            $query->where('expense_date', '<=', $to);
        }

        $records = $query->orderByDesc('expense_date')
            ->paginate($request->get('per_page', 50));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expense_category_id' => 'nullable|exists:expense_categories,id',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'description' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'expense_date' => 'required|date',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
            'affects_technician_cash' => 'boolean',
        ]);

        $expense = Expense::create([...$validated, 'created_by' => $request->user()->id]);
        return response()->json($expense->load(['category:id,name,color', 'creator:id,name']), 201);
    }

    public function show(Expense $expense): JsonResponse
    {
        return response()->json($expense->load([
            'category:id,name,color', 'creator:id,name',
            'approver:id,name', 'workOrder:id,number',
        ]));
    }

    public function update(Request $request, Expense $expense): JsonResponse
    {
        $validated = $request->validate([
            'expense_category_id' => 'nullable|exists:expense_categories,id',
            'description' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0.01',
            'expense_date' => 'sometimes|date',
            'payment_method' => 'nullable|string|max:30',
            'notes' => 'nullable|string',
            'affects_technician_cash' => 'boolean',
        ]);

        $expense->update($validated);
        return response()->json($expense->fresh()->load(['category:id,name,color']));
    }

    public function destroy(Expense $expense): JsonResponse
    {
        $expense->delete();
        return response()->json(null, 204);
    }

    // Aprovar / Rejeitar / Reembolsar
    public function updateStatus(Request $request, Expense $expense): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:approved,rejected,reimbursed',
            'rejection_reason' => 'nullable|string|max:500',
        ]);

        $newStatus = $validated['status'];

        // Validação de transição de status
        $allowed = [
            'pending'  => ['approved', 'rejected'],
            'approved' => ['reimbursed'],
        ];
        if (!in_array($newStatus, $allowed[$expense->status] ?? [])) {
            return response()->json([
                'message' => "Não é possível mudar de '{$expense->status}' para '{$newStatus}'",
            ], 422);
        }

        // Impede auto-aprovação
        if (in_array($newStatus, ['approved', 'rejected']) && $expense->created_by === $request->user()->id) {
            if (!$request->user()->hasRole('super_admin')) {
                return response()->json([
                    'message' => 'Não é permitido aprovar/rejeitar sua própria despesa',
                ], 403);
            }
        }

        $data = ['status' => $newStatus];
        if (in_array($newStatus, ['approved', 'rejected'])) {
            $data['approved_by'] = $request->user()->id;
        }

        $expense->update($data);

        // Auto-gerar débito no caixa do técnico quando despesa aprovada e affects_technician_cash
        if ($newStatus === 'approved' && $expense->affects_technician_cash && $expense->created_by) {
            $fund = \App\Models\TechnicianCashFund::getOrCreate($expense->created_by, $request->user()->tenant_id);
            $fund->addDebit(
                (float) $expense->amount,
                "Despesa #{$expense->id}: {$expense->description}",
                $expense->id,
                $request->user()->id,
                $expense->work_order_id
            );
        }

        return response()->json($expense->fresh()->load(['category:id,name,color', 'approver:id,name']));
    }

    // ── Categorias ──

    public function categories(): JsonResponse
    {
        return response()->json(ExpenseCategory::orderBy('name')->get());
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'color' => 'nullable|string|max:7',
        ]);

        return response()->json(ExpenseCategory::create($validated), 201);
    }

    // ── Summary ──

    public function summary(): JsonResponse
    {
        $pendingTotal = Expense::where('status', 'pending')->sum('amount');
        $approvedTotal = Expense::where('status', 'approved')->sum('amount');
        $monthTotal = Expense::whereMonth('expense_date', now()->month)
            ->whereYear('expense_date', now()->year)
            ->whereNotIn('status', ['rejected'])
            ->sum('amount');

        return response()->json([
            'pending' => (float) $pendingTotal,
            'approved' => (float) $approvedTotal,
            'month_total' => (float) $monthTotal,
        ]);
    }
}
