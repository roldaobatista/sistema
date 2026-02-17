<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use App\Models\Expense;
use App\Models\FinancialCheck;
use App\Models\Supplier;
use App\Models\SupplierContract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FinancialAdvancedController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1. SUPPLIER CONTRACTS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * GET /financial/supplier-contracts
     */
    public function supplierContracts(Request $request): JsonResponse
    {
        $contracts = SupplierContract::with('supplier:id,name')
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->when($request->input('supplier_id'), fn($q, $s) => $q->where('supplier_id', $s))
            ->orderByDesc('end_date')
            ->paginate(20);

        return response()->json($contracts);
    }

    /**
     * POST /financial/supplier-contracts
     */
    public function storeSupplierContract(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'description' => 'required|string|max:255',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'value' => 'required|numeric|min:0',
            'payment_frequency' => 'required|in:monthly,quarterly,annual,one_time',
            'auto_renew' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        try {
            $contract = SupplierContract::create([
                ...$validated,
                'tenant_id' => $this->tenantId(),
                'status' => 'active',
            ]);

            return response()->json([
                'message' => 'Contrato criado com sucesso',
                'data' => $contract->load('supplier:id,name'),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Supplier contract creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar contrato'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. TAX CALCULATION
    // ═══════════════════════════════════════════════════════════════════

    /**
     * POST /financial/tax-calculation
     * Calculates taxes for a given service amount.
     */
    public function taxCalculation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gross_amount' => 'required|numeric|min:0.01',
            'service_type' => 'required|string',
            'tax_regime' => 'nullable|in:simples_nacional,lucro_presumido,lucro_real',
        ]);

        $gross = (float) $validated['gross_amount'];
        $regime = $validated['tax_regime'] ?? 'simples_nacional';

        $rates = match ($regime) {
            'simples_nacional' => [
                'ISS' => 0.05,
                'PIS' => 0.0065,
                'COFINS' => 0.03,
                'IRPJ' => 0,
                'CSLL' => 0,
            ],
            'lucro_presumido' => [
                'ISS' => 0.05,
                'PIS' => 0.0065,
                'COFINS' => 0.03,
                'IRPJ' => 0.048,
                'CSLL' => 0.0288,
            ],
            'lucro_real' => [
                'ISS' => 0.05,
                'PIS' => 0.0165,
                'COFINS' => 0.076,
                'IRPJ' => 0.15,
                'CSLL' => 0.09,
            ],
        };

        $taxes = [];
        $totalTax = 0;
        foreach ($rates as $name => $rate) {
            $amount = round($gross * $rate, 2);
            $taxes[] = [
                'tax' => $name,
                'rate' => $rate * 100,
                'amount' => $amount,
            ];
            $totalTax += $amount;
        }

        return response()->json([
            'data' => [
                'gross_amount' => $gross,
                'regime' => $regime,
                'taxes' => $taxes,
                'total_tax' => round($totalTax, 2),
                'net_amount' => round($gross - $totalTax, 2),
                'effective_rate' => $gross > 0 ? round(($totalTax / $gross) * 100, 2) : 0,
            ],
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. EXPENSE REIMBURSEMENTS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * GET /financial/expense-reimbursements
     * Lists expenses eligible for reimbursement (approved status).
     */
    public function expenseReimbursements(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $statusFilter = $request->input('status', 'approved');

        $statusMap = [
            'pending' => Expense::STATUS_APPROVED,
            'approved' => Expense::STATUS_REIMBURSED,
        ];

        $expenseStatus = $statusMap[$statusFilter] ?? $statusFilter;

        $expenses = Expense::where('tenant_id', $tenantId)
            ->where('status', $expenseStatus)
            ->with(['creator:id,name', 'category:id,name,color'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($expenses);
    }

    /**
     * POST /financial/expense-reimbursements/{expense}/approve
     * Marks an approved expense as reimbursed.
     */
    public function approveReimbursement(Request $request, int $expense): JsonResponse
    {
        $tenantId = $this->tenantId();

        try {
            $expenseModel = Expense::where('id', $expense)
                ->where('tenant_id', $tenantId)
                ->where('status', Expense::STATUS_APPROVED)
                ->first();

            if (!$expenseModel) {
                return response()->json(['message' => 'Despesa não encontrada ou não está aprovada'], 404);
            }

            DB::transaction(function () use ($expenseModel) {
                $expenseModel->forceFill([
                    'status' => Expense::STATUS_REIMBURSED,
                ])->save();

                \App\Models\ExpenseStatusHistory::create([
                    'expense_id' => $expenseModel->id,
                    'changed_by' => auth()->id(),
                    'from_status' => Expense::STATUS_APPROVED,
                    'to_status' => Expense::STATUS_REIMBURSED,
                    'reason' => 'Reembolso aprovado via painel financeiro',
                ]);
            });

            return response()->json(['message' => 'Reembolso aprovado com sucesso']);
        } catch (\Exception $e) {
            Log::error('Expense reimbursement approval failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao aprovar reembolso'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. CHECK MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    /**
     * GET /financial/checks
     */
    public function checks(Request $request): JsonResponse
    {
        $checks = FinancialCheck::query()
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->when($request->input('type'), fn($q, $t) => $q->where('type', $t))
            ->orderByDesc('due_date')
            ->paginate(20);

        return response()->json($checks);
    }

    /**
     * POST /financial/checks
     */
    public function storeCheck(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|in:received,issued',
            'number' => 'required|string|max:50',
            'bank' => 'required|string|max:100',
            'amount' => 'required|numeric|min:0.01',
            'due_date' => 'required|date',
            'issuer' => 'required|string|max:255',
            'status' => 'nullable|in:pending,deposited,compensated,returned,custody',
            'notes' => 'nullable|string',
        ]);

        try {
            $check = FinancialCheck::create([
                ...$validated,
                'tenant_id' => $this->tenantId(),
                'status' => $validated['status'] ?? 'pending',
            ]);

            return response()->json([
                'message' => 'Cheque registrado com sucesso',
                'data' => $check,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Check creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar cheque'], 500);
        }
    }

    /**
     * PATCH /financial/checks/{check}/status
     */
    public function updateCheckStatus(Request $request, int $check): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,deposited,compensated,returned,custody',
        ]);

        $record = FinancialCheck::find($check);

        if (!$record) {
            return response()->json(['message' => 'Cheque não encontrado'], 404);
        }

        try {
            $record->update(['status' => $validated['status']]);
            return response()->json(['message' => 'Status atualizado com sucesso']);
        } catch (\Exception $e) {
            Log::error('Check status update failed', ['error' => $e->getMessage(), 'check_id' => $check]);
            return response()->json(['message' => 'Erro ao atualizar status do cheque'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. RECEIVABLES ANTICIPATION SIMULATOR
    // ═══════════════════════════════════════════════════════════════════

    /**
     * POST /financial/receivables-simulator
     * Simulates anticipation of receivables with discount rate.
     */
    public function receivablesSimulator(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'monthly_rate' => 'required|numeric|min:0|max:10',
            'min_amount' => 'nullable|numeric|min:0',
        ]);

        $tenantId = $this->tenantId();
        $monthlyRate = (float) $validated['monthly_rate'] / 100;
        $minAmount = (float) ($validated['min_amount'] ?? 0);

        $receivables = AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->where('due_date', '>', now())
            ->when($minAmount > 0, fn($q) => $q->whereRaw('(amount - amount_paid) >= ?', [$minAmount]))
            ->orderBy('due_date')
            ->get();

        $results = $receivables->map(function ($r) use ($monthlyRate) {
            $faceValue = round((float) $r->amount - (float) $r->amount_paid, 2);
            $daysToMaturity = max(1, now()->diffInDays($r->due_date));
            $monthsToMaturity = $daysToMaturity / 30;
            $discountFactor = pow(1 + $monthlyRate, $monthsToMaturity);
            $presentValue = round($faceValue / $discountFactor, 2);
            $discount = round($faceValue - $presentValue, 2);

            return [
                'id' => $r->id,
                'customer' => $r->customer?->name ?? 'N/A',
                'due_date' => $r->due_date,
                'days_to_maturity' => $daysToMaturity,
                'face_value' => $faceValue,
                'present_value' => $presentValue,
                'discount' => $discount,
                'effective_rate' => $faceValue > 0
                    ? round(($discount / $faceValue) * 100, 2) : 0,
            ];
        });

        $totalFace = $results->sum('face_value');
        $totalPresent = $results->sum('present_value');

        return response()->json([
            'data' => $results,
            'summary' => [
                'total_receivables' => $results->count(),
                'total_face_value' => round($totalFace, 2),
                'total_present_value' => round($totalPresent, 2),
                'total_discount' => round($totalFace - $totalPresent, 2),
                'average_discount_rate' => $totalFace > 0
                    ? round((($totalFace - $totalPresent) / $totalFace) * 100, 2) : 0,
                'monthly_rate_used' => $validated['monthly_rate'],
            ],
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. COLLECTION RULES (RÉGUA DE COBRANÇA)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * GET /financial/collection-rules
     * Returns automated collection timeline and overdue receivables.
     */
    public function collectionRules(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $overdue = AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->where('due_date', '<', now())
            ->with('customer:id,name,email,phone')
            ->orderBy('due_date')
            ->get()
            ->map(function ($r) {
                $daysOverdue = now()->diffInDays($r->due_date);
                $outstanding = round((float) $r->amount - (float) $r->amount_paid, 2);
                return [
                    'id' => $r->id,
                    'customer' => $r->customer,
                    'amount' => $outstanding,
                    'due_date' => $r->due_date,
                    'days_overdue' => $daysOverdue,
                    'collection_stage' => match (true) {
                        $daysOverdue <= 3 => 'reminder',
                        $daysOverdue <= 7 => 'first_contact',
                        $daysOverdue <= 15 => 'formal_notice',
                        $daysOverdue <= 30 => 'negotiation',
                        $daysOverdue <= 60 => 'restriction',
                        default => 'legal',
                    },
                    'suggested_action' => match (true) {
                        $daysOverdue <= 3 => 'Enviar lembrete amigável por WhatsApp/Email',
                        $daysOverdue <= 7 => 'Ligar para o cliente',
                        $daysOverdue <= 15 => 'Enviar notificação formal',
                        $daysOverdue <= 30 => 'Propor renegociação/parcelamento',
                        $daysOverdue <= 60 => 'Restringir serviços / Protestos em cartório',
                        default => 'Encaminhar para cobrança judicial',
                    },
                ];
            });

        $groupByStage = $overdue->groupBy('collection_stage')->map(fn($group) => [
            'count' => $group->count(),
            'total' => round($group->sum('amount'), 2),
        ]);

        return response()->json([
            'data' => $overdue,
            'summary' => [
                'total_overdue' => $overdue->count(),
                'total_amount' => round($overdue->sum('amount'), 2),
                'by_stage' => $groupByStage,
            ],
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. SUPPLIER ADVANCE PAYMENTS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * GET /financial/supplier-advances
     */
    public function supplierAdvances(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $advances = AccountPayable::where('tenant_id', $tenantId)
            ->where('type', 'advance')
            ->with('supplier:id,name')
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($advances);
    }

    /**
     * POST /financial/supplier-advances
     */
    public function storeSupplierAdvance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:255',
            'due_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $advance = AccountPayable::create([
                'tenant_id' => $this->tenantId(),
                'created_by' => auth()->id(),
                'supplier_id' => $validated['supplier_id'],
                'description' => '[Adiantamento] ' . $validated['description'],
                'amount' => $validated['amount'],
                'amount_paid' => 0,
                'due_date' => $validated['due_date'],
                'status' => 'pending',
                'notes' => $validated['notes'] ?? null,
            ]);

            DB::commit();
            return response()->json([
                'message' => 'Adiantamento registrado com sucesso',
                'data' => $advance,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Supplier advance creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar adiantamento'], 500);
        }
    }
}
