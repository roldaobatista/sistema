<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use App\Models\Supplier;
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
        $tenantId = $this->tenantId();

        $contracts = DB::table('supplier_contracts')
            ->where('tenant_id', $tenantId)
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

        $validated['tenant_id'] = $this->tenantId();
        $validated['status'] = 'active';
        $validated['created_at'] = now();
        $validated['updated_at'] = now();

        try {
            $id = DB::table('supplier_contracts')->insertGetId($validated);
            return response()->json([
                'message' => 'Contrato criado com sucesso',
                'data' => DB::table('supplier_contracts')->find($id),
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
     * Lists pending and processed expense reimbursements.
     */
    public function expenseReimbursements(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $status = $request->input('status', 'pending');

        $expenses = DB::table('expenses')
            ->where('expenses.tenant_id', $tenantId)
            ->where('expenses.reimbursement_status', $status)
            ->where('expenses.payment_source', 'own_money')
            ->join('users', 'expenses.user_id', '=', 'users.id')
            ->select(
                'expenses.*',
                'users.name as user_name'
            )
            ->orderByDesc('expenses.created_at')
            ->paginate(20);

        return response()->json($expenses);
    }

    /**
     * POST /financial/expense-reimbursements/{expense}/approve
     */
    public function approveReimbursement(Request $request, int $expense): JsonResponse
    {
        $tenantId = $this->tenantId();

        try {
            DB::beginTransaction();

            $updated = DB::table('expenses')
                ->where('id', $expense)
                ->where('tenant_id', $tenantId)
                ->update([
                    'reimbursement_status' => 'approved',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                    'updated_at' => now(),
                ]);

            if (!$updated) {
                DB::rollBack();
                return response()->json(['message' => 'Despesa não encontrada'], 404);
            }

            DB::commit();
            return response()->json(['message' => 'Reembolso aprovado com sucesso']);
        } catch (\Exception $e) {
            DB::rollBack();
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
        $tenantId = $this->tenantId();

        $checks = DB::table('financial_checks')
            ->where('tenant_id', $tenantId)
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

        $validated['tenant_id'] = $this->tenantId();
        $validated['status'] = $validated['status'] ?? 'pending';
        $validated['created_at'] = now();
        $validated['updated_at'] = now();

        try {
            $id = DB::table('financial_checks')->insertGetId($validated);
            return response()->json([
                'message' => 'Cheque registrado com sucesso',
                'data' => DB::table('financial_checks')->find($id),
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

        try {
            DB::beginTransaction();

            $updated = DB::table('financial_checks')
                ->where('id', $check)
                ->where('tenant_id', $this->tenantId())
                ->update([
                    'status' => $validated['status'],
                    'updated_at' => now(),
                ]);

            if (!$updated) {
                DB::rollBack();
                return response()->json(['message' => 'Cheque não encontrado'], 404);
            }

            DB::commit();
            return response()->json(['message' => 'Status atualizado com sucesso']);
        } catch (\Exception $e) {
            DB::rollBack();
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
            ->when($minAmount > 0, fn($q) => $q->where('net_amount', '>=', $minAmount))
            ->orderBy('due_date')
            ->get();

        $results = $receivables->map(function ($r) use ($monthlyRate) {
            $daysToMaturity = max(1, now()->diffInDays($r->due_date));
            $monthsToMaturity = $daysToMaturity / 30;
            $discountFactor = pow(1 + $monthlyRate, $monthsToMaturity);
            $presentValue = round((float) $r->net_amount / $discountFactor, 2);
            $discount = round((float) $r->net_amount - $presentValue, 2);

            return [
                'id' => $r->id,
                'customer' => $r->customer?->name ?? 'N/A',
                'due_date' => $r->due_date,
                'days_to_maturity' => $daysToMaturity,
                'face_value' => (float) $r->net_amount,
                'present_value' => $presentValue,
                'discount' => $discount,
                'effective_rate' => (float) $r->net_amount > 0
                    ? round(($discount / (float) $r->net_amount) * 100, 2) : 0,
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
                return [
                    'id' => $r->id,
                    'customer' => $r->customer,
                    'amount' => (float) $r->net_amount,
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
                'supplier_id' => $validated['supplier_id'],
                'description' => $validated['description'],
                'gross_amount' => $validated['amount'],
                'net_amount' => $validated['amount'],
                'due_date' => $validated['due_date'],
                'type' => 'advance',
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
