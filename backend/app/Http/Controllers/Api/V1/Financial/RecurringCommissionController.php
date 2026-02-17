<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionEvent;
use App\Models\CommissionRule;
use App\Models\RecurringCommission;
use App\Models\RecurringContract;
use App\Models\WorkOrder;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class RecurringCommissionController extends Controller
{
    use ApiResponseTrait;

    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = RecurringCommission::where('recurring_commissions.tenant_id', $this->tenantId())
            ->join('users', 'recurring_commissions.user_id', '=', 'users.id')
            ->join('commission_rules', 'recurring_commissions.commission_rule_id', '=', 'commission_rules.id')
            ->leftJoin('recurring_contracts', 'recurring_commissions.recurring_contract_id', '=', 'recurring_contracts.id')
            ->select(
                'recurring_commissions.*',
                'users.name as user_name',
                'commission_rules.name as rule_name',
                'commission_rules.calculation_type',
                'commission_rules.value as rule_value',
                'recurring_contracts.name as contract_name'
            );

        if ($status = $request->get('status')) {
            $query->where('recurring_commissions.status', $status);
        }

        return response()->json($query->orderByDesc('recurring_commissions.created_at')->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $validated = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'recurring_contract_id' => ['required', Rule::exists('recurring_contracts', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'commission_rule_id' => ['required', Rule::exists('commission_rules', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ]);

        $existing = RecurringCommission::where('tenant_id', $tenantId)
            ->where('user_id', $validated['user_id'])
            ->where('recurring_contract_id', $validated['recurring_contract_id'])
            ->where('status', RecurringCommission::STATUS_ACTIVE)
            ->exists();

        if ($existing) {
            return $this->error('Já existe comissão recorrente ativa para este usuário e contrato', 422);
        }

        try {
            $rec = DB::transaction(function () use ($tenantId, $validated) {
                return RecurringCommission::create([
                    'tenant_id' => $tenantId,
                    'user_id' => $validated['user_id'],
                    'recurring_contract_id' => $validated['recurring_contract_id'],
                    'commission_rule_id' => $validated['commission_rule_id'],
                    'status' => RecurringCommission::STATUS_ACTIVE,
                ]);
            });

            return $this->success(['id' => $rec->id], 'Comissão recorrente criada', 201);
        } catch (\Exception $e) {
            Log::error('Falha ao criar comissão recorrente', ['error' => $e->getMessage()]);
            return $this->error('Erro interno ao criar comissão recorrente', 500);
        }
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:' . RecurringCommission::STATUS_ACTIVE . ',' . RecurringCommission::STATUS_PAUSED . ',' . RecurringCommission::STATUS_TERMINATED,
        ]);

        $rec = RecurringCommission::where('tenant_id', $this->tenantId())->find($id);

        if (!$rec) {
            return $this->error('Comissão recorrente não encontrada', 404);
        }

        $rec->update(['status' => $validated['status']]);

        return $this->success(null, 'Status atualizado');
    }

    public function processMonthly(): JsonResponse
    {
        $tid = $this->tenantId();
        $now = now();
        $period = $now->format('Y-m');

        $recurrings = RecurringCommission::where('tenant_id', $tid)
            ->where('status', RecurringCommission::STATUS_ACTIVE)
            ->get();

        try {
            $generated = 0;

            DB::transaction(function () use ($recurrings, $tid, $now, $period, &$generated) {
                foreach ($recurrings as $rec) {
                    if ($rec->last_generated_at && $rec->last_generated_at->format('Y-m') === $period) {
                        continue;
                    }

                    $contract = RecurringContract::where('tenant_id', $tid)->find($rec->recurring_contract_id);
                    if (!$contract || !($contract->is_active ?? false)) {
                        continue;
                    }

                    $rule = $rec->commissionRule;
                    if (!$rule || !$rule->active) {
                        continue;
                    }

                    $baseAmount = (float) ($contract->monthly_value ?? $contract->total_value ?? 0);
                    if ($baseAmount <= 0) {
                        continue;
                    }

                    $workOrder = WorkOrder::where('tenant_id', $tid)
                        ->where('recurring_contract_id', $rec->recurring_contract_id)
                        ->whereYear('created_at', $now->year)
                        ->whereMonth('created_at', $now->month)
                        ->orderByDesc('id')
                        ->first();

                    if (!$workOrder) {
                        continue;
                    }

                    $commissionAmount = $rule->calculateCommission($baseAmount, [
                        'gross' => $baseAmount,
                        'expenses' => 0,
                        'displacement' => 0,
                        'products_total' => 0,
                        'services_total' => $baseAmount,
                        'cost' => 0,
                    ]);

                    if (bccomp((string) $commissionAmount, '0', 2) <= 0) {
                        continue;
                    }

                    CommissionEvent::create([
                        'tenant_id' => $tid,
                        'commission_rule_id' => $rule->id,
                        'work_order_id' => $workOrder->id,
                        'user_id' => $rec->user_id,
                        'base_amount' => $baseAmount,
                        'commission_amount' => $commissionAmount,
                        'status' => CommissionEvent::STATUS_PENDING,
                        'notes' => "Recorrente: OS " . ($workOrder->os_number ?? $workOrder->number) . " / Contrato #{$rec->recurring_contract_id} ({$period})",
                    ]);

                    $rec->update(['last_generated_at' => $now->toDateString()]);
                    $generated++;
                }
            });

            return $this->success(['generated' => $generated], "{$generated} comissões recorrentes geradas");
        } catch (\Exception $e) {
            Log::error('Falha ao processar comissões recorrentes', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->error('Erro interno ao processar comissões recorrentes', 500);
        }
    }

    public function destroy(int $id): JsonResponse
    {
        $rec = RecurringCommission::where('tenant_id', $this->tenantId())->find($id);

        if (!$rec) {
            return $this->error('Comissão recorrente não encontrada', 404);
        }

        try {
            DB::transaction(fn () => $rec->delete());
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Falha ao excluir comissão recorrente', ['error' => $e->getMessage(), 'recurring_id' => $id]);
            return $this->error('Erro interno ao excluir comissão recorrente', 500);
        }
    }
}
