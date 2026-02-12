<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionEvent;
use App\Models\CommissionRule;
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

    private const STATUS_ACTIVE = 'active';
    private const STATUS_PAUSED = 'paused';
    private const STATUS_TERMINATED = 'terminated';

    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = DB::table('recurring_commissions')
            ->where('recurring_commissions.tenant_id', $this->tenantId())
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

        return response()->json($query->orderByDesc('recurring_commissions.created_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $validated = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'recurring_contract_id' => ['required', Rule::exists('recurring_contracts', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'commission_rule_id' => ['required', Rule::exists('commission_rules', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ]);

        try {
            $id = DB::transaction(function () use ($tenantId, $validated) {
                return DB::table('recurring_commissions')->insertGetId([
                    'tenant_id' => $tenantId,
                    'user_id' => $validated['user_id'],
                    'recurring_contract_id' => $validated['recurring_contract_id'],
                    'commission_rule_id' => $validated['commission_rule_id'],
                    'status' => self::STATUS_ACTIVE,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            return $this->success(['id' => $id], 'Comissão recorrente criada', 201);
        } catch (\Exception $e) {
            Log::error('Falha ao criar comissão recorrente', ['error' => $e->getMessage()]);
            return $this->error('Erro interno ao criar comissão recorrente', 500);
        }
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:' . self::STATUS_ACTIVE . ',' . self::STATUS_PAUSED . ',' . self::STATUS_TERMINATED,
        ]);

        $updated = DB::table('recurring_commissions')
            ->where('id', $id)
            ->where('tenant_id', $this->tenantId())
            ->update(['status' => $validated['status'], 'updated_at' => now()]);

        if (!$updated) {
            return $this->error('Comissão recorrente não encontrada', 404);
        }

        return $this->success(null, 'Status atualizado');
    }

    /** Generate monthly commission events for all active recurring commissions */
    public function processMonthly(): JsonResponse
    {
        $tid = $this->tenantId();
        $now = now();
        $period = $now->format('Y-m');

        $recurrings = DB::table('recurring_commissions')
            ->where('tenant_id', $tid)
            ->where('status', self::STATUS_ACTIVE)
            ->get();

        try {
            $generated = 0;

            DB::transaction(function () use ($recurrings, $tid, $now, $period, &$generated) {
                foreach ($recurrings as $rec) {
                    if ($rec->last_generated_at && substr($rec->last_generated_at, 0, 7) === $period) {
                        continue;
                    }

                    $contract = DB::table('recurring_contracts')
                        ->where('tenant_id', $tid)
                        ->where('id', $rec->recurring_contract_id)
                        ->first();
                    if (!$contract || !(bool) ($contract->is_active ?? false)) continue;

                    $rule = CommissionRule::where('tenant_id', $tid)->find($rec->commission_rule_id);
                    if (!$rule || !$rule->active) continue;

                    $baseAmount = (float) ($contract->monthly_value ?? $contract->total_value ?? 0);
                    if ($baseAmount <= 0) continue;

                    $workOrder = WorkOrder::query()
                        ->where('tenant_id', $tid)
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

                    if ($commissionAmount <= 0) continue;

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

                    DB::table('recurring_commissions')->where('id', $rec->id)->update([
                        'last_generated_at' => $now->toDateString(),
                        'updated_at' => $now,
                    ]);

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
        try {
            $deleted = DB::table('recurring_commissions')
                ->where('id', $id)
                ->where('tenant_id', $this->tenantId())
                ->delete();

            if (!$deleted) {
                return $this->error('Comissão recorrente não encontrada', 404);
            }

            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Falha ao excluir comissão recorrente', ['error' => $e->getMessage(), 'recurring_id' => $id]);
            return $this->error('Erro interno ao excluir comissão recorrente', 500);
        }
    }
}
