<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\ExpenseStatusHistory;
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
            $query = Expense::with(['category:id,name,color', 'creator:id,name', 'workOrder:id,number,os_number', 'chartOfAccount:id,code,name,type'])
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
            if ($woId = $request->get('work_order_id')) {
                $query->where('work_order_id', $woId);
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

                ExpenseStatusHistory::create([
                    'expense_id' => $expense->id,
                    'changed_by' => $request->user()->id,
                    'from_status' => null,
                    'to_status' => Expense::STATUS_PENDING,
                ]);

                return $expense;
            });

            $duplicateCount = Expense::where('tenant_id', $tenantId)
                ->where('description', $validated['description'])
                ->where('amount', $validated['amount'])
                ->where('expense_date', $validated['expense_date'])
                ->where('id', '!=', $expense->id)
                ->count();

            $budgetWarning = $this->checkBudgetLimit($expense, $tenantId);

            $response = $expense->load(['category:id,name,color', 'creator:id,name', 'workOrder:id,number,os_number', 'chartOfAccount:id,code,name,type'])->toArray();
            if ($duplicateCount > 0) {
                $response['_warning'] = "Possivel duplicidade: {$duplicateCount} despesa(s) com mesma descricao, valor e data.";
            }
            if ($budgetWarning) {
                $response['_budget_warning'] = $budgetWarning;
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
                'chartOfAccount:id,code,name,type',
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

            $budgetWarning = $this->checkBudgetLimit($expense->fresh(), $tenantId);
            $response = $expense->fresh()->load(['category:id,name,color', 'workOrder:id,number,os_number', 'chartOfAccount:id,code,name,type'])->toArray();
            if ($budgetWarning) {
                $response['_budget_warning'] = $budgetWarning;
            }

            return response()->json($response);
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

            $receiptPath = $expense->receipt_path;

            DB::transaction(function () use ($expense) {
                $expense->delete();
            });

            if ($receiptPath) {
                $oldPath = str_replace('/storage/', '', $receiptPath);
                Storage::disk('public')->delete($oldPath);
            }

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

            $oldStatus = $expense->status;

            DB::transaction(function () use ($expense, $data, $newStatus, $oldStatus, $rejectionReason, $request) {
                $expense->forceFill($data)->save();

                ExpenseStatusHistory::create([
                    'expense_id' => $expense->id,
                    'changed_by' => $request->user()->id,
                    'from_status' => $oldStatus,
                    'to_status' => $newStatus,
                    'reason' => $newStatus === Expense::STATUS_REJECTED ? $rejectionReason : null,
                ]);

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

                if ($newStatus === Expense::STATUS_PENDING) {
                    $expense->forceFill(['rejection_reason' => null])->save();
                }
            });

            return response()->json($expense->fresh()->load(['category:id,name,color', 'approver:id,name', 'chartOfAccount:id,code,name,type']));
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
                    ->withCount(['expenses' => fn ($q) => $q->withoutTrashed()])
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
                'budget_limit' => 'nullable|numeric|min:0',
            ]);

            $category = DB::transaction(fn () => ExpenseCategory::create([
                ...$validated,
                'tenant_id' => $tenantId,
            ]));

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
                'budget_limit' => 'nullable|numeric|min:0',
            ]);

            DB::transaction(fn () => $category->update($validated));

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

            if ($category->expenses()->withoutTrashed()->exists()) {
                return response()->json([
                    'message' => 'Categoria possui despesas vinculadas. Remova ou reclassifique antes de excluir.',
                ], 422);
            }

            DB::transaction(fn () => $category->delete());

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
            $currentMonth = now()->month;
            $currentYear = now()->year;

            $driver = DB::getDriverName();
            if ($driver === 'sqlite') {
                $monthCondition = "CAST(strftime('%m', expense_date) AS INTEGER) = ? AND CAST(strftime('%Y', expense_date) AS INTEGER) = ?";
            } else {
                $monthCondition = "MONTH(expense_date) = ? AND YEAR(expense_date) = ?";
            }

            $stats = Expense::where('tenant_id', $tenantId)
                ->selectRaw("
                    SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_total,
                    SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_total,
                    SUM(CASE WHEN status = 'reimbursed' THEN amount ELSE 0 END) as reimbursed_total,
                    SUM(CASE WHEN status != 'rejected' AND {$monthCondition} THEN amount ELSE 0 END) as month_total,
                    COUNT(*) as total_count,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
                ", [$currentMonth, $currentYear])
                ->first();

            return response()->json([
                'pending' => round((float) ($stats->pending_total ?? 0), 2),
                'approved' => round((float) ($stats->approved_total ?? 0), 2),
                'month_total' => round((float) ($stats->month_total ?? 0), 2),
                'reimbursed' => round((float) ($stats->reimbursed_total ?? 0), 2),
                'total_count' => (int) ($stats->total_count ?? 0),
                'pending_count' => (int) ($stats->pending_count ?? 0),
            ]);
        } catch (\Exception $e) {
            Log::error('Expense summary failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar resumo'], 500);
        }
    }

    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);
            $query = Expense::with(['category:id,name', 'creator:id,name', 'workOrder:id,number,os_number', 'approver:id,name', 'chartOfAccount:id,code,name,type'])
                ->where('tenant_id', $tenantId);

            if ($status = $request->get('status')) {
                $query->where('status', $status);
            }
            if ($catId = $request->get('expense_category_id')) {
                $query->where('expense_category_id', $catId);
            }
            if ($from = $request->get('date_from')) {
                $query->where('expense_date', '>=', $from);
            }
            if ($to = $request->get('date_to')) {
                $query->where('expense_date', '<=', $to);
            }
            if ($userId = $request->get('created_by')) {
                $query->where('created_by', $userId);
            }

            $expenses = $query->orderByDesc('expense_date')->get();

            $statusLabels = [
                Expense::STATUS_PENDING => 'Pendente',
                Expense::STATUS_APPROVED => 'Aprovado',
                Expense::STATUS_REJECTED => 'Rejeitado',
                Expense::STATUS_REIMBURSED => 'Reembolsado',
            ];

            $headers = [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="despesas_' . now()->format('Y-m-d') . '.csv"',
            ];

            return response()->stream(function () use ($expenses, $statusLabels) {
                $out = fopen('php://output', 'w');
                fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));
                fputcsv($out, ['ID', 'Descricao', 'Valor', 'Data', 'Status', 'Categoria', 'Conta Contabil', 'Responsavel', 'Aprovador', 'OS', 'Forma Pgto', 'Observacoes'], ';');

                foreach ($expenses as $exp) {
                    fputcsv($out, [
                        $exp->id,
                        $exp->description,
                        number_format((float) $exp->amount, 2, ',', '.'),
                        $exp->expense_date?->format('d/m/Y'),
                        $statusLabels[$exp->status] ?? $exp->status,
                        $exp->category?->name ?? '',
                        $exp->chartOfAccount ? trim(($exp->chartOfAccount->code ?? '') . ' - ' . ($exp->chartOfAccount->name ?? ''), ' -') : '',
                        $exp->creator?->name ?? '',
                        $exp->approver?->name ?? '',
                        $exp->workOrder?->os_number ?? $exp->workOrder?->number ?? '',
                        $exp->payment_method ?? '',
                        $exp->notes ?? '',
                    ], ';');
                }
                fclose($out);
            }, 200, $headers);
        } catch (\Exception $e) {
            Log::error('Expense export failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao exportar despesas'], 500);
        }
    }

    public function analytics(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $from = $request->get('date_from', now()->startOfMonth()->toDateString());
            $to = $request->get('date_to', now()->endOfMonth()->toDateString());

            $categoryIds = Expense::where('tenant_id', $tenantId)
                ->whereBetween('expense_date', [$from, $to])
                ->whereNotIn('status', [Expense::STATUS_REJECTED])
                ->distinct()
                ->pluck('expense_category_id')
                ->filter();

            $categoriesMap = ExpenseCategory::whereIn('id', $categoryIds)
                ->get()
                ->keyBy('id');

            $byCategory = Expense::where('tenant_id', $tenantId)
                ->whereBetween('expense_date', [$from, $to])
                ->whereNotIn('status', [Expense::STATUS_REJECTED])
                ->selectRaw('expense_category_id, SUM(amount) as total, COUNT(*) as count')
                ->groupBy('expense_category_id')
                ->get()
                ->map(function ($row) use ($categoriesMap) {
                    $cat = $categoriesMap->get($row->expense_category_id);
                    return [
                        'category_id' => $row->expense_category_id,
                        'category_name' => $cat?->name ?? 'Sem categoria',
                        'category_color' => $cat?->color ?? '#6b7280',
                        'budget_limit' => $cat?->budget_limit,
                        'total' => bcadd((string) $row->total, '0', 2),
                        'count' => $row->count,
                    ];
                });

            $byStatus = Expense::where('tenant_id', $tenantId)
                ->whereBetween('expense_date', [$from, $to])
                ->selectRaw('status, SUM(amount) as total, COUNT(*) as count')
                ->groupBy('status')
                ->get()
                ->keyBy('status')
                ->map(fn ($row) => [
                    'total' => bcadd((string) $row->total, '0', 2),
                    'count' => $row->count,
                ]);

            $byMonth = Expense::where('tenant_id', $tenantId)
                ->whereNotIn('status', [Expense::STATUS_REJECTED])
                ->where('expense_date', '>=', now()->subMonths(6)->startOfMonth()->toDateString())
                ->selectRaw("DATE_FORMAT(expense_date, '%Y-%m') as month, SUM(amount) as total")
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->map(fn ($row) => [
                    'month' => $row->month,
                    'total' => bcadd((string) $row->total, '0', 2),
                ]);

            $creatorIds = Expense::where('tenant_id', $tenantId)
                ->whereBetween('expense_date', [$from, $to])
                ->whereNotIn('status', [Expense::STATUS_REJECTED])
                ->distinct()
                ->pluck('created_by')
                ->filter();

            $usersMap = \App\Models\User::whereIn('id', $creatorIds)
                ->pluck('name', 'id');

            $topCreators = Expense::where('tenant_id', $tenantId)
                ->whereBetween('expense_date', [$from, $to])
                ->whereNotIn('status', [Expense::STATUS_REJECTED])
                ->selectRaw('created_by, SUM(amount) as total, COUNT(*) as count')
                ->groupBy('created_by')
                ->orderByDesc('total')
                ->limit(10)
                ->get()
                ->map(fn ($row) => [
                    'user_id' => $row->created_by,
                    'user_name' => $usersMap->get($row->created_by, 'Desconhecido'),
                    'total' => bcadd((string) $row->total, '0', 2),
                    'count' => $row->count,
                ]);

            return response()->json([
                'period' => ['from' => $from, 'to' => $to],
                'by_category' => $byCategory,
                'by_status' => $byStatus,
                'by_month' => $byMonth,
                'top_creators' => $topCreators,
            ]);
        } catch (\Exception $e) {
            Log::error('Expense analytics failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao gerar analytics'], 500);
        }
    }

    public function batchUpdateStatus(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $validated = $request->validate([
                'expense_ids' => 'required|array|min:1|max:100',
                'expense_ids.*' => 'integer',
                'status' => ['required', Rule::in([Expense::STATUS_APPROVED, Expense::STATUS_REJECTED])],
                'rejection_reason' => 'nullable|string|max:500',
            ]);

            $newStatus = $validated['status'];
            $rejectionReason = trim((string) ($validated['rejection_reason'] ?? ''));

            if ($newStatus === Expense::STATUS_REJECTED && $rejectionReason === '') {
                return response()->json([
                    'message' => 'Informe o motivo da rejeicao',
                    'errors' => ['rejection_reason' => ['O motivo da rejeicao e obrigatorio para rejeição em lote.']],
                ], 422);
            }

            $expenses = Expense::where('tenant_id', $tenantId)
                ->whereIn('id', $validated['expense_ids'])
                ->where('status', Expense::STATUS_PENDING)
                ->get();

            if ($expenses->isEmpty()) {
                return response()->json(['message' => 'Nenhuma despesa pendente encontrada nos IDs informados'], 422);
            }

            $processed = 0;
            $skipped = 0;

            DB::transaction(function () use ($expenses, $newStatus, $rejectionReason, $request, $tenantId, &$processed, &$skipped) {
                foreach ($expenses as $expense) {
                    if (in_array($newStatus, [Expense::STATUS_APPROVED, Expense::STATUS_REJECTED], true) && $expense->created_by === $request->user()->id) {
                        if (!$request->user()->hasRole('super_admin')) {
                            $skipped++;
                            continue;
                        }
                    }

                    $oldStatus = $expense->status;
                    $data = [
                        'status' => $newStatus,
                        'rejection_reason' => $newStatus === Expense::STATUS_REJECTED ? $rejectionReason : null,
                    ];
                    if ($newStatus === Expense::STATUS_APPROVED) {
                        $data['approved_by'] = $request->user()->id;
                    }

                    $expense->forceFill($data)->save();

                    ExpenseStatusHistory::create([
                        'expense_id' => $expense->id,
                        'changed_by' => $request->user()->id,
                        'from_status' => $oldStatus,
                        'to_status' => $newStatus,
                        'reason' => $newStatus === Expense::STATUS_REJECTED ? $rejectionReason : null,
                    ]);

                    if ($newStatus === Expense::STATUS_APPROVED && $expense->affects_technician_cash && $expense->created_by) {
                        $fund = TechnicianCashFund::getOrCreate($expense->created_by, $tenantId);
                        $fund->addDebit(
                            (float) $expense->amount,
                            "Despesa #{$expense->id}: {$expense->description}",
                            $expense->id,
                            $request->user()->id,
                            $expense->work_order_id,
                            allowNegative: true,
                        );
                    }

                    $processed++;
                }
            });

            return response()->json([
                'message' => "{$processed} despesa(s) atualizadas com sucesso" . ($skipped > 0 ? " ({$skipped} ignorada(s) por auto-aprovação)" : ''),
                'processed' => $processed,
                'skipped' => $skipped,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Expense batchUpdateStatus failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao processar lote'], 500);
        }
    }

    public function duplicate(Request $request, Expense $expense): JsonResponse
    {
        try {
            if ($expense->tenant_id !== $this->tenantId($request)) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            $clone = DB::transaction(function () use ($expense, $request) {
                $clone = new Expense([
                    'tenant_id' => $expense->tenant_id,
                    'expense_category_id' => $expense->expense_category_id,
                    'work_order_id' => $expense->work_order_id,
                    'created_by' => $request->user()->id,
                    'description' => $expense->description,
                    'amount' => $expense->amount,
                    'expense_date' => now()->toDateString(),
                    'payment_method' => $expense->payment_method,
                    'notes' => $expense->notes,
                    'affects_technician_cash' => $expense->affects_technician_cash,
                ]);
                $clone->forceFill(['status' => Expense::STATUS_PENDING]);
                $clone->save();

                ExpenseStatusHistory::create([
                    'expense_id' => $clone->id,
                    'changed_by' => $request->user()->id,
                    'from_status' => null,
                    'to_status' => Expense::STATUS_PENDING,
                    'reason' => "Duplicada da despesa #{$expense->id}",
                ]);

                return $clone;
            });

            return response()->json(
                $clone->load(['category:id,name,color', 'creator:id,name', 'workOrder:id,number,os_number']),
                201
            );
        } catch (\Exception $e) {
            Log::error('Expense duplicate failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao duplicar despesa'], 500);
        }
    }

    public function history(Request $request, Expense $expense): JsonResponse
    {
        try {
            if ($expense->tenant_id !== $this->tenantId($request)) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            $history = ExpenseStatusHistory::where('expense_id', $expense->id)
                ->with('changedBy:id,name')
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($h) => [
                    'id' => $h->id,
                    'from_status' => $h->from_status,
                    'to_status' => $h->to_status,
                    'reason' => $h->reason,
                    'changed_by' => $h->changedBy?->name ?? 'Desconhecido',
                    'changed_at' => $h->created_at->toIso8601String(),
                ]);

            return response()->json($history);
        } catch (\Exception $e) {
            Log::error('Expense history failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar histórico'], 500);
        }
    }

    private function checkBudgetLimit(Expense $expense, int $tenantId): ?string
    {
        if (!$expense->expense_category_id) {
            return null;
        }

        $category = ExpenseCategory::find($expense->expense_category_id);
        if (!$category || !$category->budget_limit) {
            return null;
        }

        $currentMonth = $expense->expense_date?->month ?? now()->month;
        $currentYear = $expense->expense_date?->year ?? now()->year;

        $monthTotal = Expense::where('tenant_id', $tenantId)
            ->where('expense_category_id', $expense->expense_category_id)
            ->whereMonth('expense_date', $currentMonth)
            ->whereYear('expense_date', $currentYear)
            ->whereNotIn('status', [Expense::STATUS_REJECTED])
            ->sum('amount');

        if (bccomp((string) $monthTotal, (string) $category->budget_limit, 2) > 0) {
            $used = bcadd((string) $monthTotal, '0', 2);
            $limit = bcadd((string) $category->budget_limit, '0', 2);
            return "Orcamento da categoria '{$category->name}' ultrapassado: R$ {$used} de R$ {$limit}";
        }

        return null;
    }
}
