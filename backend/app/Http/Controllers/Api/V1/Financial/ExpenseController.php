<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\TechnicianCashFund;
use App\Http\Requests\Financial\StoreExpenseRequest;
use App\Http\Requests\Financial\UpdateExpenseRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);
            $query = Expense::with(['category:id,name,color', 'creator:id,name', 'workOrder:id,number,os_number'])
                ->where('tenant_id', $tenantId);

            if ($search = $request->get('search')) {
                $query->where(function ($q) use ($search) {
                    $q->where('description', 'like', "%{$search}%")
                        ->orWhereHas('workOrder', function ($wo) use ($search) {
                            $wo->where('number', 'like', "%{$search}%")
                                ->orWhere('os_number', 'like', "%{$search}%");
                        });
                });
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
        } catch (\Exception $e) {
            Log::error('Expense index failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao listar despesas'], 500);
        }
    }

    public function store(StoreExpenseRequest $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);
            $validated = $request->validated();

            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store("tenants/{$tenantId}/receipts", 'public');
                $receiptPath = "/storage/{$path}";
            }

            $expense = DB::transaction(function () use ($validated, $tenantId, $request, $receiptPath) {
                $data = $validated;
                if ($receiptPath) {
                    $data['receipt_path'] = $receiptPath;
                }
                unset($data['receipt'], $data['status']);

                $expense = new Expense([
                    ...$data,
                    'tenant_id' => $tenantId,
                    'created_by' => $request->user()->id,
                ]);
                $expense->forceFill(['status' => Expense::STATUS_PENDING]);
                $expense->save();
                return $expense;
            });

            $duplicateCount = Expense::where('tenant_id', $tenantId)
                ->where('description', $validated['description'])
                ->where('amount', $validated['amount'])
                ->where('expense_date', $validated['expense_date'])
                ->where('id', '!=', $expense->id)
                ->count();

            $response = $expense->load(['category:id,name,color', 'creator:id,name', 'workOrder:id,number,os_number'])->toArray();
            if ($duplicateCount > 0) {
                $response['_warning'] = "Possivel duplicidade: {$duplicateCount} despesa(s) com mesma descricao, valor e data.";
            }

            return response()->json($response, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Expense store failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao criar despesa'], 500);
        }
    }

    public function show(Request $request, Expense $expense): JsonResponse
    {
        try {
            if ($expense->tenant_id !== $this->tenantId($request)) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            return response()->json($expense->load([
                'category:id,name,color',
                'creator:id,name',
                'approver:id,name',
                'workOrder:id,number,os_number',
            ]));
        } catch (\Exception $e) {
            Log::error('Expense show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar despesa'], 500);
        }
    }

    public function update(UpdateExpenseRequest $request, Expense $expense): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            if ($expense->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            if (in_array($expense->status, [Expense::STATUS_APPROVED, Expense::STATUS_REIMBURSED], true)) {
                return response()->json([
                    'message' => 'Não é possível editar despesa já aprovada ou reembolsada',
                ], 422);
            }

            $validated = $request->validated();
            $data = $validated;
            unset($data['receipt'], $data['status']);

            if ($request->hasFile('receipt')) {
                if ($expense->receipt_path) {
                    $oldPath = str_replace('/storage/', '', $expense->receipt_path);
                    Storage::disk('public')->delete($oldPath);
                }
                $path = $request->file('receipt')->store("tenants/{$tenantId}/receipts", 'public');
                $data['receipt_path'] = "/storage/{$path}";
            }

            DB::transaction(fn () => $expense->update($data));

            return response()->json($expense->fresh()->load(['category:id,name,color', 'workOrder:id,number,os_number']));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Expense update failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao atualizar despesa'], 500);
        }
    }

    public function destroy(Request $request, Expense $expense): JsonResponse
    {
        try {
            if ($expense->tenant_id !== $this->tenantId($request)) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            if (in_array($expense->status, [Expense::STATUS_APPROVED, Expense::STATUS_REIMBURSED], true)) {
                return response()->json([
                    'message' => 'Não é possível excluir despesa já aprovada ou reembolsada',
                ], 422);
            }

            if ($expense->receipt_path) {
                $oldPath = str_replace('/storage/', '', $expense->receipt_path);
                Storage::disk('public')->delete($oldPath);
            }

            $expense->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Expense destroy failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao excluir despesa'], 500);
        }
    }

    public function updateStatus(Request $request, Expense $expense): JsonResponse
    {
        try {
            if ($expense->tenant_id !== $this->tenantId($request)) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            $validated = $request->validate([
                'status' => ['required', Rule::in([Expense::STATUS_PENDING, Expense::STATUS_APPROVED, Expense::STATUS_REJECTED, Expense::STATUS_REIMBURSED])],
                'rejection_reason' => 'nullable|string|max:500',
            ]);

            $newStatus = $validated['status'];
            $rejectionReason = trim((string) ($validated['rejection_reason'] ?? ''));

            $allowed = [
                Expense::STATUS_PENDING => [Expense::STATUS_APPROVED, Expense::STATUS_REJECTED],
                Expense::STATUS_APPROVED => [Expense::STATUS_REIMBURSED],
                Expense::STATUS_REJECTED => [Expense::STATUS_PENDING],
            ];
            if (!in_array($newStatus, $allowed[$expense->status] ?? [], true)) {
                return response()->json([
                    'message' => "Nao e possivel mudar de '{$expense->status}' para '{$newStatus}'",
                ], 422);
            }

            if (in_array($newStatus, [Expense::STATUS_APPROVED, Expense::STATUS_REJECTED], true) && $expense->created_by === $request->user()->id) {
                if (!$request->user()->hasRole('super_admin')) {
                    return response()->json([
                        'message' => 'Nao e permitido aprovar/rejeitar sua propria despesa',
                    ], 403);
                }
            }

            if ($newStatus === Expense::STATUS_REJECTED && $rejectionReason === '') {
                return response()->json([
                    'message' => 'Informe o motivo da rejeicao',
                    'errors' => [
                        'rejection_reason' => ['O motivo da rejeicao e obrigatorio.'],
                    ],
                ], 422);
            }

            $data = [
                'status' => $newStatus,
                'rejection_reason' => $newStatus === Expense::STATUS_REJECTED
                    ? $rejectionReason
                    : null,
            ];
            if ($newStatus === Expense::STATUS_APPROVED) {
                $data['approved_by'] = $request->user()->id;
            } elseif ($newStatus === Expense::STATUS_REJECTED) {
                $data['approved_by'] = null;
            }

            DB::transaction(function () use ($expense, $data, $newStatus, $request) {
                $expense->forceFill($data)->save();

                if ($newStatus === Expense::STATUS_APPROVED && $expense->affects_technician_cash && $expense->created_by) {
                    $fund = TechnicianCashFund::getOrCreate($expense->created_by, $this->tenantId($request));
                    $fund->addDebit(
                        (float) $expense->amount,
                        "Despesa #{$expense->id}: {$expense->description}",
                        $expense->id,
                        $request->user()->id,
                        $expense->work_order_id,
                        allowNegative: true,
                    );
                }

                if ($newStatus === Expense::STATUS_REIMBURSED && $expense->affects_technician_cash && $expense->created_by) {
                    $fund = TechnicianCashFund::getOrCreate($expense->created_by, $this->tenantId($request));
                    $fund->addCredit(
                        (float) $expense->amount,
                        "Reembolso da despesa #{$expense->id}: {$expense->description}",
                        $request->user()->id,
                        $expense->work_order_id
                    );
                }
            });

            return response()->json($expense->fresh()->load(['category:id,name,color', 'approver:id,name']));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Expense updateStatus failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao atualizar status'], 500);
        }
    }

    public function categories(Request $request): JsonResponse
    {
        try {
            return response()->json(
                ExpenseCategory::where('tenant_id', $this->tenantId($request))
                    ->where('active', true)
                    ->orderBy('name')
                    ->get()
            );
        } catch (\Exception $e) {
            Log::error('Expense categories failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar categorias'], 500);
        }
    }

    public function storeCategory(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:100', Rule::unique('expense_categories')->where(fn ($q) => $q->where('tenant_id', $tenantId)->whereNull('deleted_at'))],
                'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            ]);

            $category = ExpenseCategory::create([
                ...$validated,
                'tenant_id' => $tenantId,
            ]);

            return response()->json($category, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Expense storeCategory failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao criar categoria'], 500);
        }
    }

    public function updateCategory(Request $request, ExpenseCategory $category): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            if ($category->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            $validated = $request->validate([
                'name' => [
                    'sometimes', 'string', 'max:100',
                    Rule::unique('expense_categories')->where(fn ($q) => $q->where('tenant_id', $tenantId)->whereNull('deleted_at'))->ignore($category->id),
                ],
                'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
                'active' => 'boolean',
            ]);
            $category->update($validated);

            return response()->json($category);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Expense updateCategory failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao atualizar categoria'], 500);
        }
    }

    public function destroyCategory(Request $request, ExpenseCategory $category): JsonResponse
    {
        try {
            if ($category->tenant_id !== $this->tenantId($request)) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            if ($category->expenses()->exists()) {
                return response()->json([
                    'message' => 'Categoria possui despesas vinculadas. Remova ou reclassifique antes de excluir.',
                ], 422);
            }

            $category->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Expense destroyCategory failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao excluir categoria'], 500);
        }
    }

    public function summary(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $pendingTotal = (string) Expense::where('tenant_id', $tenantId)->where('status', Expense::STATUS_PENDING)->sum('amount');
            $approvedTotal = (string) Expense::where('tenant_id', $tenantId)->where('status', Expense::STATUS_APPROVED)->sum('amount');
            $monthTotal = (string) Expense::where('tenant_id', $tenantId)->whereMonth('expense_date', now()->month)
                ->whereYear('expense_date', now()->year)
                ->whereNotIn('status', [Expense::STATUS_REJECTED])
                ->sum('amount');

            return response()->json([
                'pending' => round((float) $pendingTotal, 2),
                'approved' => round((float) $approvedTotal, 2),
                'month_total' => round((float) $monthTotal, 2),
            ]);
        } catch (\Exception $e) {
            Log::error('Expense summary failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar resumo'], 500);
        }
    }
}
