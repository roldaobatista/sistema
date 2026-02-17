<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Http\Controllers\Controller;
use App\Models\AccountPayable;
use App\Models\BankAccount;
use App\Models\FundTransfer;
use App\Models\TechnicianCashFund;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FundTransferController extends Controller
{
    use ResolvesCurrentTenant;

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $query = FundTransfer::where('tenant_id', $tenantId)
            ->with([
                'bankAccount:id,name,bank_name',
                'technician:id,name',
                'creator:id,name',
            ])
            ->orderByDesc('transfer_date')
            ->orderByDesc('id');

        if ($userId = $request->get('to_user_id')) {
            $query->where('to_user_id', $userId);
        }

        if ($bankAccountId = $request->get('bank_account_id')) {
            $query->where('bank_account_id', $bankAccountId);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($from = $request->get('date_from')) {
            $query->where('transfer_date', '>=', $from);
        }

        if ($to = $request->get('date_to')) {
            $query->where('transfer_date', '<=', $to);
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhereHas('technician', fn ($tq) => $tq->where('name', 'like', "%{$search}%"))
                  ->orWhereHas('bankAccount', fn ($bq) => $bq->where('name', 'like', "%{$search}%"));
            });
        }

        $transfers = $query->paginate($request->get('per_page', 20));

        return response()->json($transfers);
    }

    public function show(Request $request, FundTransfer $fundTransfer): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        if ((int) $fundTransfer->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Transferência não encontrada'], 404);
        }

        return response()->json(
            $fundTransfer->load([
                'bankAccount:id,name,bank_name,agency,account_number',
                'technician:id,name',
                'accountPayable:id,description,amount,status',
                'cashTransaction:id,type,amount,balance_after',
                'creator:id,name',
            ])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $validated = $request->validate([
            'bank_account_id' => [
                'required',
                Rule::exists('bank_accounts', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId)->where('is_active', true)),
            ],
            'to_user_id' => ['required', Rule::exists('users', 'id')],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'transfer_date' => ['required', 'date'],
            'payment_method' => ['required', 'string', 'max:30'],
            'description' => ['required', 'string', 'max:255'],
        ]);

        $bankAccount = BankAccount::find($validated['bank_account_id']);
        if (bccomp((string) $bankAccount->balance, (string) $validated['amount'], 2) < 0) {
            throw ValidationException::withMessages([
                'amount' => ['Saldo insuficiente na conta bancária.'],
            ]);
        }

        // Validate technician belongs to tenant
        $technician = User::find($validated['to_user_id']);
        $belongsToTenant = User::where('id', $validated['to_user_id'])
            ->where(function ($query) use ($tenantId) {
                $query->where('tenant_id', $tenantId)
                    ->orWhere('current_tenant_id', $tenantId)
                    ->orWhereHas('tenants', fn ($tq) => $tq->where('tenants.id', $tenantId));
            })
            ->exists();

        if (!$belongsToTenant) {
            throw ValidationException::withMessages([
                'to_user_id' => ['Técnico não pertence ao tenant atual.'],
            ]);
        }

        try {
            DB::beginTransaction();

            // 1. Create AccountPayable (financial record of the outflow)
            $ap = AccountPayable::create([
                'tenant_id' => $tenantId,
                'created_by' => $request->user()->id,
                'description' => "Adiantamento Técnico: {$technician->name} — {$validated['description']}",
                'due_date' => $validated['transfer_date'],
                'status' => AccountPayable::STATUS_PAID, // Already paid by transfer
                'amount' => $validated['amount'], // Required field
                'amount_paid' => $validated['amount'],
                'paid_at' => $validated['transfer_date'],
                'payment_method' => $validated['payment_method'],
                'notes' => "Transferência automática para caixa do técnico",
            ]);

            // 2. Credit the technician's cash fund
            $fund = TechnicianCashFund::getOrCreate($validated['to_user_id'], $tenantId);
            $cashTx = $fund->addCredit(
                (float) $validated['amount'],
                "Transferência via {$validated['payment_method']}: {$validated['description']}",
                $request->user()->id,
            );

            // 3. Create the FundTransfer record
            $transfer = FundTransfer::create([
                'tenant_id' => $tenantId,
                'bank_account_id' => $validated['bank_account_id'],
                'to_user_id' => $validated['to_user_id'],
                'amount' => $validated['amount'],
                'transfer_date' => $validated['transfer_date'],
                'payment_method' => $validated['payment_method'],
                'description' => $validated['description'],
                'account_payable_id' => $ap->id,
                'technician_cash_transaction_id' => $cashTx->id,
                'status' => FundTransfer::STATUS_COMPLETED,
                'created_by' => $request->user()->id,
            ]);

            // 4. Debit Bank Account
            $bankAccount = BankAccount::find($validated['bank_account_id']);
            $bankAccount->decrement('balance', $validated['amount']);

            DB::commit();

            return response()->json(
                $transfer->load([
                    'bankAccount:id,name,bank_name',
                    'technician:id,name',
                    'creator:id,name',
                ]),
                201
            );
        } catch (ValidationException $e) {
            DB::rollBack();
            throw $e;
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('FundTransfer create failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao criar transferência: ' . $e->getMessage()], 500);
        }
    }

    public function cancel(Request $request, FundTransfer $fundTransfer): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        if ((int) $fundTransfer->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Transferência não encontrada'], 404);
        }

        if ($fundTransfer->status === FundTransfer::STATUS_CANCELLED) {
            return response()->json(['message' => 'Transferência já está cancelada'], 422);
        }

        try {
            DB::beginTransaction();

            // 1. Reverse the credit in technician's cash fund
            $fund = TechnicianCashFund::getOrCreate($fundTransfer->to_user_id, $tenantId);
            $fund->addDebit(
                (float) $fundTransfer->amount,
                "Cancelamento de transferência #{$fundTransfer->id}: {$fundTransfer->description}",
                null,
                $request->user()->id,
                null,
                true // allowNegative — cancellation must always succeed
            );

            // 2. Cancel the linked AccountPayable
            if ($fundTransfer->account_payable_id) {
                $ap = AccountPayable::find($fundTransfer->account_payable_id);
                if ($ap) {
                    $ap->update([
                        'status' => AccountPayable::STATUS_CANCELLED,
                        'notes' => ($ap->notes ? $ap->notes . "\n" : '') . "Cancelada por estorno de transferência #{$fundTransfer->id}",
                    ]);
                }
            }

            // 3. Update transfer status
            $fundTransfer->update(['status' => FundTransfer::STATUS_CANCELLED]);

            // 4. Credit Bank Account (Refund)
            $fundTransfer->bankAccount->increment('balance', $fundTransfer->amount);

            DB::commit();

            return response()->json(
                $fundTransfer->fresh()->load([
                    'bankAccount:id,name,bank_name',
                    'technician:id,name',
                    'creator:id,name',
                ])
            );
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('FundTransfer cancel failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao cancelar transferência: ' . $e->getMessage()], 500);
        }
    }

    public function summary(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $monthTotal = FundTransfer::where('tenant_id', $tenantId)
            ->where('status', FundTransfer::STATUS_COMPLETED)
            ->whereMonth('transfer_date', now()->month)
            ->whereYear('transfer_date', now()->year)
            ->sum('amount');

        $totalAll = FundTransfer::where('tenant_id', $tenantId)
            ->where('status', FundTransfer::STATUS_COMPLETED)
            ->sum('amount');

        $byTechnician = FundTransfer::where('tenant_id', $tenantId)
            ->where('status', FundTransfer::STATUS_COMPLETED)
            ->whereMonth('transfer_date', now()->month)
            ->whereYear('transfer_date', now()->year)
            ->select('to_user_id', DB::raw('SUM(amount) as total'))
            ->groupBy('to_user_id')
            ->with('technician:id,name')
            ->get();

        return response()->json([
            'month_total' => round((float) $monthTotal, 2),
            'total_all' => round((float) $totalAll, 2),
            'by_technician' => $byTechnician,
        ]);
    }
}
