<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionRule;
use App\Models\CommissionEvent;
use App\Models\CommissionSettlement;
use App\Models\Expense;
use Carbon\Carbon;
use App\Traits\ApiResponseTrait;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class CommissionController extends Controller
{
    use ApiResponseTrait;

    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    /** Cross-DB period filter (SQLite + MySQL compatible) */
    private function wherePeriod($query, string $column, string $period)
    {
        if (DB::getDriverName() === 'sqlite') {
            $query->whereRaw("strftime('%Y-%m', {$column}) = ?", [$period]);
        } else {
            $query->whereRaw("DATE_FORMAT({$column}, '%Y-%m') = ?", [$period]);
        }
        return $query;
    }

    private function osNumberFilter(Request $request): ?string
    {
        $osNumber = trim((string) $request->get('os_number', ''));
        return $osNumber !== '' ? $osNumber : null;
    }

    private function applyWorkOrderIdentifierFilter($query, ?string $osNumber): void
    {
        if (!$osNumber) {
            return;
        }

        $query->whereHas('workOrder', function ($wo) use ($osNumber) {
            $wo->where(function ($q) use ($osNumber) {
                $q->where('os_number', 'like', "%{$osNumber}%")
                    ->orWhere('number', 'like', "%{$osNumber}%");
            });
        });
    }

    // ── Regras ──

    public function rules(Request $request): JsonResponse
    {
        $query = CommissionRule::where('tenant_id', $this->tenantId())
            ->with('user:id,name');

        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($role = $request->get('applies_to_role')) {
            $query->where('applies_to_role', $role);
        }

        return response()->json($query->orderBy('priority')->orderBy('name')->get());
    }

    public function showRule(CommissionRule $commissionRule): JsonResponse
    {
        if ((int) $commissionRule->tenant_id !== $this->tenantId()) {
            return response()->json(['message' => 'Registro não encontrado'], 404);
        }

        return response()->json($commissionRule->load('user:id,name'));
    }

    public function storeRule(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $validated = $request->validate([
            'user_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'name' => 'required|string|max:255',
            'type' => ['sometimes', Rule::in([CommissionRule::TYPE_PERCENTAGE, CommissionRule::TYPE_FIXED])],
            'value' => 'required|numeric|min:0',
            'applies_to' => ['sometimes', Rule::in([CommissionRule::APPLIES_ALL, CommissionRule::APPLIES_PRODUCTS, CommissionRule::APPLIES_SERVICES])],
            'calculation_type' => ['required', Rule::in(array_keys(CommissionRule::CALCULATION_TYPES))],
            'applies_to_role' => ['sometimes', Rule::in([CommissionRule::ROLE_TECHNICIAN, CommissionRule::ROLE_SELLER, CommissionRule::ROLE_DRIVER])],
            'applies_when' => ['sometimes', Rule::in([CommissionRule::WHEN_OS_COMPLETED, CommissionRule::WHEN_INSTALLMENT_PAID, CommissionRule::WHEN_OS_INVOICED])],
            'tiers' => 'nullable|array',
            'priority' => 'sometimes|integer',
            'active' => 'sometimes|boolean',
        ]);

        try {
            $validated['tenant_id'] = $tenantId;
            $validated['applies_to'] = $validated['applies_to'] ?? CommissionRule::APPLIES_ALL;
            $validated['applies_to_role'] = $validated['applies_to_role'] ?? CommissionRule::ROLE_TECHNICIAN;
            $validated['applies_when'] = $validated['applies_when'] ?? CommissionRule::WHEN_OS_COMPLETED;

            $rule = DB::transaction(fn () => CommissionRule::create($validated));

            return response()->json($rule->load('user:id,name'), 201);
        } catch (\Exception $e) {
            Log::error('Falha ao criar regra de comissão', ['error' => $e->getMessage()]);
            return $this->error('Erro interno ao criar regra', 500);
        }
    }

    public function updateRule(Request $request, CommissionRule $commissionRule): JsonResponse
    {
        abort_if($commissionRule->tenant_id !== $this->tenantId(), 404);

        $validated = $request->validate([
            'user_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $this->tenantId()))],
            'name' => 'sometimes|string|max:255',
            'type' => ['sometimes', Rule::in([CommissionRule::TYPE_PERCENTAGE, CommissionRule::TYPE_FIXED])],
            'value' => 'sometimes|numeric|min:0',
            'applies_to' => ['sometimes', Rule::in([CommissionRule::APPLIES_ALL, CommissionRule::APPLIES_PRODUCTS, CommissionRule::APPLIES_SERVICES])],
            'calculation_type' => ['sometimes', Rule::in(array_keys(CommissionRule::CALCULATION_TYPES))],
            'applies_to_role' => ['sometimes', Rule::in([CommissionRule::ROLE_TECHNICIAN, CommissionRule::ROLE_SELLER, CommissionRule::ROLE_DRIVER])],
            'applies_when' => ['sometimes', Rule::in([CommissionRule::WHEN_OS_COMPLETED, CommissionRule::WHEN_INSTALLMENT_PAID, CommissionRule::WHEN_OS_INVOICED])],
            'tiers' => 'nullable|array',
            'priority' => 'sometimes|integer',
            'active' => 'sometimes|boolean',
        ]);

        try {
            DB::transaction(fn () => $commissionRule->update($validated));
            return response()->json($commissionRule->fresh()->load('user:id,name'));
        } catch (\Exception $e) {
            Log::error('Falha ao atualizar regra de comissão', ['error' => $e->getMessage(), 'rule_id' => $commissionRule->id]);
            return $this->error('Erro interno ao atualizar regra', 500);
        }
    }

    public function destroyRule(CommissionRule $commissionRule): JsonResponse
    {
        abort_if($commissionRule->tenant_id !== $this->tenantId(), 404);

        $eventsCount = CommissionEvent::where('commission_rule_id', $commissionRule->id)->count();
        if ($eventsCount > 0) {
            return $this->error("Não é possível excluir: existem {$eventsCount} evento(s) vinculados a esta regra", 409);
        }

        try {
            DB::transaction(fn () => $commissionRule->delete());
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Falha ao excluir regra de comissão', ['error' => $e->getMessage(), 'rule_id' => $commissionRule->id]);
            return $this->error('Erro interno ao excluir regra', 500);
        }
    }

    /** Tipos de cálculo disponíveis */
    public function calculationTypes(): JsonResponse
    {
        return response()->json(CommissionRule::CALCULATION_TYPES);
    }

    // ── Eventos ──

    public function events(Request $request): JsonResponse
    {
        $osNumber = $this->osNumberFilter($request);
        $query = CommissionEvent::where('tenant_id', $this->tenantId())
            ->with(['user:id,name', 'workOrder:id,number,os_number', 'rule:id,name,calculation_type']);

        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }
        if ($period = $request->get('period')) {
            $this->wherePeriod($query, 'created_at', $period);
        }
        $this->applyWorkOrderIdentifierFilter($query, $osNumber);

        return response()->json(
            $query->orderByDesc('created_at')->paginate($request->get('per_page', 50))
        );
    }

    // ── Injeção de Dependência ──
    protected \App\Services\CommissionService $commissionService;

    public function __construct(\App\Services\CommissionService $commissionService)
    {
        $this->commissionService = $commissionService;
    }

    /** Gerar comissões para uma OS — suporta 10+ calculation_types */
    public function generateForWorkOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => [
                'required',
                Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $this->tenantId())),
            ],
        ]);

        $wo = \App\Models\WorkOrder::findOrFail($validated['work_order_id']);

        try {
            $events = $this->commissionService->calculateAndGenerate($wo);
            
            // Notification is now handled here or could be moved to service events, 
            // but keeping it here for now to match previous behavior (controller orchestrates notifications)
            $this->notifyCommissionGenerated($events);

            return $this->success(['generated' => count($events), 'events' => $events], 'Comissões geradas', 201);
            
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    /** Simular comissão (preview sem salvar) */
    public function simulate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => [
                'required',
                Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $this->tenantId())),
            ],
        ]);

        $wo = \App\Models\WorkOrder::findOrFail($validated['work_order_id']);

        $simulations = $this->commissionService->simulate($wo);

        return response()->json($simulations);
    }

    public function updateEventStatus(Request $request, CommissionEvent $commissionEvent): JsonResponse
    {
        abort_if($commissionEvent->tenant_id !== $this->tenantId(), 404);

        $validated = $request->validate([
            'status' => ['required', Rule::in(array_keys(CommissionEvent::STATUSES))],
            'notes' => 'nullable|string',
        ]);

        $oldStatus = $commissionEvent->status;
        $newStatus = $validated['status'];

        // Validate status transitions
        $validTransitions = [
            CommissionEvent::STATUS_PENDING => [CommissionEvent::STATUS_APPROVED, CommissionEvent::STATUS_REVERSED],
            CommissionEvent::STATUS_APPROVED => [CommissionEvent::STATUS_PAID, CommissionEvent::STATUS_REVERSED],
            CommissionEvent::STATUS_PAID => [CommissionEvent::STATUS_REVERSED],
            CommissionEvent::STATUS_REVERSED => [CommissionEvent::STATUS_PENDING],
        ];
        if (!in_array($newStatus, $validTransitions[$oldStatus] ?? [])) {
            return response()->json(['message' => "Transição de status inválida: {$oldStatus} → {$newStatus}"], 422);
        }

        try {
            DB::transaction(function () use ($commissionEvent, $validated, $oldStatus, $newStatus) {
                $commissionEvent->update($validated);

                if (in_array($newStatus, [CommissionEvent::STATUS_APPROVED, CommissionEvent::STATUS_PAID])) {
                    $this->notifyStatusChange($commissionEvent, $oldStatus, $newStatus);
                }
            });

            return response()->json($commissionEvent->fresh());
        } catch (\Exception $e) {
            Log::error('Falha ao atualizar status do evento de comissão', ['error' => $e->getMessage(), 'event_id' => $commissionEvent->id]);
            return $this->error('Erro interno ao atualizar status', 500);
        }
    }

    /** Aprovação/Estorno em lote */
    public function batchUpdateStatus(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => ['integer', Rule::exists('commission_events', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'status' => ['required', Rule::in(array_keys(CommissionEvent::STATUSES))],
        ]);

        $events = CommissionEvent::where('tenant_id', $tenantId)
            ->whereIn('id', $validated['ids'])
            ->get();

        $validTransitions = [
            CommissionEvent::STATUS_PENDING => [CommissionEvent::STATUS_APPROVED, CommissionEvent::STATUS_REVERSED],
            CommissionEvent::STATUS_APPROVED => [CommissionEvent::STATUS_PAID, CommissionEvent::STATUS_REVERSED],
            CommissionEvent::STATUS_PAID => [CommissionEvent::STATUS_REVERSED],
            CommissionEvent::STATUS_REVERSED => [CommissionEvent::STATUS_PENDING],
        ];

        try {
            $updated = 0;
            $skipped = 0;

            DB::transaction(function () use ($events, $validated, $validTransitions, &$updated, &$skipped) {
                foreach ($events as $event) {
                    if (!in_array($validated['status'], $validTransitions[$event->status] ?? [])) {
                        $skipped++;
                        continue;
                    }
                    $oldStatus = $event->status;
                    $event->update(['status' => $validated['status']]);
                    $updated++;

                    if (in_array($validated['status'], [CommissionEvent::STATUS_APPROVED, CommissionEvent::STATUS_PAID])) {
                        $this->notifyStatusChange($event, $oldStatus, $validated['status']);
                    }
                }
            });

            $message = "{$updated} eventos atualizados";
            if ($skipped > 0) {
                $message .= ", {$skipped} ignorados (transição inválida)";
            }

            return $this->success(['updated' => $updated, 'skipped' => $skipped], $message);
        } catch (\Exception $e) {
            Log::error('Falha no batch update de comissões', ['error' => $e->getMessage()]);
            return $this->error('Erro interno ao atualizar eventos em lote', 500);
        }
    }

    // ── Splits ──

    public function eventSplits(CommissionEvent $commissionEvent): JsonResponse
    {
        abort_if($commissionEvent->tenant_id !== $this->tenantId(), 404);

        $splits = DB::table('commission_splits')
            ->where('commission_event_id', $commissionEvent->id)
            ->where('commission_splits.tenant_id', $this->tenantId())
            ->join('users', 'commission_splits.user_id', '=', 'users.id')
            ->select('commission_splits.*', 'users.name as user_name')
            ->get();

        return response()->json($splits);
    }

    public function splitEvent(Request $request, CommissionEvent $commissionEvent): JsonResponse
    {
        $tenantId = $this->tenantId();

        $validated = $request->validate([
            'splits' => 'required|array|min:2',
            'splits.*.user_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'splits.*.percentage' => 'required|numeric|min:0.01|max:100',
        ]);

        $totalPct = collect($validated['splits'])->sum('percentage');
        if (abs($totalPct - 100) > 0.01) {
            return $this->error('A soma das porcentagens deve ser exatamente 100%', 422);
        }

        $baseAmount = (float) $commissionEvent->commission_amount;

        $splits = DB::transaction(function () use ($commissionEvent, $validated, $tenantId, $baseAmount) {
            // Delete existing splits
            DB::table('commission_splits')->where('commission_event_id', $commissionEvent->id)->delete();

            $splits = [];
            foreach ($validated['splits'] as $s) {
                $amount = round($baseAmount * ($s['percentage'] / 100), 2);
                $splitId = DB::table('commission_splits')->insertGetId([
                    'tenant_id' => $tenantId,
                    'commission_event_id' => $commissionEvent->id,
                    'user_id' => $s['user_id'],
                    'percentage' => $s['percentage'],
                    'amount' => $amount,
                    'role' => $s['role'] ?? CommissionRule::ROLE_TECHNICIAN,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $splits[] = ['id' => $splitId, 'user_id' => $s['user_id'], 'percentage' => $s['percentage'], 'amount' => $amount];
            }
            return $splits;
        });

        return $this->success($splits, 'Splits criados');
    }

    // ── Fechamento ──

    public function settlements(Request $request): JsonResponse
    {
        $query = CommissionSettlement::where('tenant_id', $this->tenantId())
            ->with('user:id,name');

        if ($period = $request->get('period')) {
            $query->where('period', $period);
        }
        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }

        return response()->json($query->orderByDesc('period')->get());
    }

    public function closeSettlement(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $validated = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'period' => ['required', 'string', 'size:7', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        // Block future periods
        if ($validated['period'] > now()->format('Y-m')) {
            return $this->error('Não é permitido fechar períodos futuros', 422);
        }

        $query = CommissionEvent::where('tenant_id', $tenantId)
            ->where('user_id', $validated['user_id'])
            ->where('status', CommissionEvent::STATUS_APPROVED);
        $this->wherePeriod($query, 'created_at', $validated['period']);
        $events = $query->get();

        if ($events->isEmpty()) {
            return $this->error('Nenhum evento aprovado para este período', 422);
        }

        $settlement = CommissionSettlement::where('tenant_id', $tenantId)
            ->where('user_id', $validated['user_id'])
            ->where('period', $validated['period'])
            ->first();

        if ($settlement && $settlement->status === CommissionSettlement::STATUS_PAID) {
            return $this->error('Período já pago e não pode ser reaberto', 422);
        }

        $settlement = DB::transaction(function () use ($tenantId, $validated, $events) {
            $settlement = CommissionSettlement::updateOrCreate(
                ['tenant_id' => $tenantId, 'user_id' => $validated['user_id'], 'period' => $validated['period']],
                [
                    'total_amount' => $events->sum('commission_amount'),
                    'events_count' => $events->count(),
                    'status' => CommissionSettlement::STATUS_CLOSED,
                    'paid_at' => null,
                ]
            );

            // Events stay APPROVED — they will be marked PAID only when paySettlement is called

            return $settlement;
        });

        return response()->json($settlement->load('user:id,name'), 201);
    }

    public function paySettlement(Request $request, CommissionSettlement $commissionSettlement): JsonResponse
    {
        $tenantId = $this->tenantId();
        if ((int) $commissionSettlement->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Registro não encontrado'], 404);
        }

        if ($commissionSettlement->status === CommissionSettlement::STATUS_PAID) {
            return $this->error('Fechamento já está pago', 422);
        }

        if ($commissionSettlement->status !== CommissionSettlement::STATUS_CLOSED) {
            return $this->error('Somente fechamentos com status fechado podem ser pagos', 422);
        }

        DB::beginTransaction();
        try {
            $commissionSettlement->update([
                'status' => CommissionSettlement::STATUS_PAID,
                'paid_at' => now(),
            ]);

            // Marcar eventos do período que ainda estejam aprovados como pagos
            $eventsQuery = CommissionEvent::where('tenant_id', $commissionSettlement->tenant_id)
                ->where('user_id', $commissionSettlement->user_id)
                ->where('status', CommissionEvent::STATUS_APPROVED);
            $this->wherePeriod($eventsQuery, 'created_at', $commissionSettlement->period);
            $eventsQuery->update(['status' => CommissionEvent::STATUS_PAID]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Falha ao pagar fechamento', ['error' => $e->getMessage(), 'settlement_id' => $commissionSettlement->id]);
            return $this->error('Erro interno ao pagar fechamento', 500);
        }

        return response()->json($commissionSettlement->fresh()->load('user:id,name'));
    }

    public function reopenSettlement(CommissionSettlement $commissionSettlement): JsonResponse
    {
        $tenantId = $this->tenantId();
        if ((int) $commissionSettlement->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Registro não encontrado'], 404);
        }

        if ($commissionSettlement->status === CommissionSettlement::STATUS_PAID) {
            return $this->error('Fechamento já foi pago e não pode ser reaberto', 422);
        }

        if ($commissionSettlement->status !== CommissionSettlement::STATUS_CLOSED) {
            return $this->error('Somente fechamentos com status fechado podem ser reabertos', 422);
        }

        try {
            DB::transaction(function () use ($commissionSettlement) {
                $commissionSettlement->update(['status' => CommissionSettlement::STATUS_OPEN, 'paid_at' => null]);

                $periodStart = \Illuminate\Support\Carbon::parse($commissionSettlement->period . '-01');
                $periodEnd = $periodStart->copy()->addMonth();

                CommissionEvent::where('tenant_id', $commissionSettlement->tenant_id)
                    ->where('user_id', $commissionSettlement->user_id)
                    ->where('status', CommissionEvent::STATUS_APPROVED)
                    ->where('created_at', '>=', $periodStart)
                    ->where('created_at', '<', $periodEnd)
                    ->update(['status' => CommissionEvent::STATUS_PENDING]);
            });
        } catch (\Exception $e) {
            Log::error('Falha ao reabrir fechamento', ['error' => $e->getMessage(), 'settlement_id' => $commissionSettlement->id]);
            return $this->error('Erro interno ao reabrir fechamento', 500);
        }

        return response()->json($commissionSettlement->fresh()->load('user:id,name'));
    }

    /**
     * GAP-25: Aprovar settlement (workflow: Nayara fecha → Roldão aprova → pode pagar).
     */
    public function approveSettlement(Request $request, CommissionSettlement $commissionSettlement): JsonResponse
    {
        $tenantId = $this->tenantId();
        if ((int) $commissionSettlement->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Registro não encontrado'], 404);
        }

        if ($commissionSettlement->status !== CommissionSettlement::STATUS_CLOSED) {
            return $this->error('Somente fechamentos com status "fechado" podem ser aprovados', 422);
        }

        try {
            DB::transaction(function () use ($commissionSettlement, $request) {
                $commissionSettlement->update([
                    'status' => CommissionSettlement::STATUS_APPROVED,
                    'approved_by' => $request->user()->id,
                    'approved_at' => now(),
                ]);
            });

            return response()->json($commissionSettlement->fresh()->load('user:id,name'));
        } catch (\Exception $e) {
            Log::error('Falha ao aprovar settlement', ['error' => $e->getMessage(), 'id' => $commissionSettlement->id]);
            return $this->error('Erro interno ao aprovar fechamento', 500);
        }
    }

    /**
     * GAP-25: Rejeitar settlement (volta para "open" com motivo).
     */
    public function rejectSettlement(Request $request, CommissionSettlement $commissionSettlement): JsonResponse
    {
        $tenantId = $this->tenantId();
        if ((int) $commissionSettlement->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Registro não encontrado'], 404);
        }

        if ($commissionSettlement->status !== CommissionSettlement::STATUS_CLOSED) {
            return $this->error('Somente fechamentos com status "fechado" podem ser rejeitados', 422);
        }

        $validated = $request->validate([
            'rejection_reason' => 'required|string|max:500',
        ]);

        try {
            DB::transaction(function () use ($commissionSettlement, $validated) {
                $commissionSettlement->update([
                    'status' => CommissionSettlement::STATUS_OPEN,
                    'rejection_reason' => $validated['rejection_reason'],
                    'approved_by' => null,
                    'approved_at' => null,
                    'paid_at' => null,
                ]);
            });

            return response()->json($commissionSettlement->fresh()->load('user:id,name'));
        } catch (\Exception $e) {
            Log::error('Falha ao rejeitar settlement', ['error' => $e->getMessage(), 'id' => $commissionSettlement->id]);
            return $this->error('Erro interno ao rejeitar fechamento', 500);
        }
    }

    // ── Export ──

    public function exportEvents(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        try {
            $tenantId = $this->tenantId();
            $osNumber = $this->osNumberFilter($request);
            $query = CommissionEvent::where('tenant_id', $tenantId)
                ->with(['user:id,name', 'workOrder:id,number,os_number', 'rule:id,name,calculation_type']);

            if ($userId = $request->get('user_id')) $query->where('user_id', $userId);
            if ($status = $request->get('status')) $query->where('status', $status);
            if ($period = $request->get('period')) $this->wherePeriod($query, 'created_at', $period);
            $this->applyWorkOrderIdentifierFilter($query, $osNumber);

            $events = $query->orderByDesc('created_at')->get();

            return response()->streamDownload(function () use ($events) {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['Nome', 'OS', 'Regra', 'Tipo Cálculo', 'Valor Base', 'Comissão', 'Status', 'Data']);
                foreach ($events as $e) {
                    fputcsv($out, [
                        $e->user?->name, $e->workOrder?->os_number ?? $e->workOrder?->number, $e->rule?->name,
                        $e->rule?->calculation_type, $e->base_amount, $e->commission_amount,
                        $e->status, $e->created_at?->format('Y-m-d'),
                    ]);
                }
                fclose($out);
            }, 'comissoes_eventos_' . now()->format('Y-m-d') . '.csv', [
                'Content-Type' => 'text/csv',
            ]);
        } catch (\Exception $e) {
            Log::error('Falha ao exportar eventos de comissão', ['error' => $e->getMessage()]);
            return $this->error('Erro ao exportar eventos', 500);
        }
    }

    public function exportSettlements(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        try {
            $settlements = CommissionSettlement::where('tenant_id', $this->tenantId())
                ->with('user:id,name')->orderByDesc('period')->get();

            return response()->streamDownload(function () use ($settlements) {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['Nome', 'Período', 'Qtd Eventos', 'Total', 'Status', 'Pago Em']);
                foreach ($settlements as $s) {
                    fputcsv($out, [
                        $s->user?->name, $s->period, $s->events_count,
                        $s->total_amount, $s->status, $s->paid_at?->format('Y-m-d') ?? '',
                    ]);
                }
                fclose($out);
            }, 'comissoes_fechamento_' . now()->format('Y-m-d') . '.csv', [
                'Content-Type' => 'text/csv',
            ]);
        } catch (\Exception $e) {
            Log::error('Falha ao exportar fechamentos de comissão', ['error' => $e->getMessage()]);
            return $this->error('Erro ao exportar fechamentos', 500);
        }
    }

    public function downloadStatement(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        $tenantId = $this->tenantId();
        $validated = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'period' => ['required', 'string', 'size:7', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        $settlement = CommissionSettlement::where('tenant_id', $tenantId)
            ->where('user_id', $validated['user_id'])
            ->where('period', $validated['period'])
            ->first();

        $query = CommissionEvent::where('tenant_id', $tenantId)
            ->where('user_id', $validated['user_id'])
            ->with(['workOrder:id,number,os_number', 'rule:id,name,calculation_type'])
            ->orderBy('created_at');
        $this->wherePeriod($query, 'created_at', $validated['period']);

        $events = $query->get();
        if ($events->isEmpty()) {
            return response()->json(['message' => 'Nenhum evento encontrado para este periodo'], 404);
        }

        $user = \App\Models\User::find($validated['user_id']);
        $total = (float) ($settlement?->total_amount ?? $events->sum('commission_amount'));
        $html = view('pdf.commission-statement', [
            'userName' => $user?->name ?? "Usuario {$validated['user_id']}",
            'period' => $validated['period'],
            'generatedAt' => now(),
            'events' => $events,
            'totalAmount' => $total,
            'eventsCount' => $events->count(),
            'settlementStatus' => $settlement?->status,
            'paidAt' => $settlement?->paid_at,
        ])->render();

        $pdf = Pdf::loadHTML($html)->setPaper('A4', 'portrait');
        return $pdf->download("comissao-extrato-{$validated['period']}-{$validated['user_id']}.pdf");
    }

    // ── Summary ──

    public function summary(): JsonResponse
    {
        $tenantId = $this->tenantId();

        $pendingTotal = CommissionEvent::where('tenant_id', $tenantId)->where('status', CommissionEvent::STATUS_PENDING)->sum('commission_amount');
        $approvedTotal = CommissionEvent::where('tenant_id', $tenantId)->where('status', CommissionEvent::STATUS_APPROVED)->sum('commission_amount');
        $paidMonth = CommissionEvent::where('tenant_id', $tenantId)->where('status', CommissionEvent::STATUS_PAID)
            ->whereMonth('updated_at', now()->month)
            ->whereYear('updated_at', now()->year)
            ->sum('commission_amount');

        return response()->json([
            'pending' => (float) $pendingTotal,
            'approved' => (float) $approvedTotal,
            'paid_this_month' => (float) $paidMonth,
            'calculation_types_count' => count(CommissionRule::CALCULATION_TYPES),
        ]);
    }

    // ── Helpers: Notifications ──

    private function notifyCommissionGenerated(array $events): void
    {
        try {
            // Eager load workOrder para evitar N+1 queries
            $eventsCollection = CommissionEvent::with('workOrder:id,number,os_number')
                ->whereIn('id', collect($events)->pluck('id'))->get()->keyBy('id');

            foreach ($events as $event) {
                $loaded = $eventsCollection->get($event->id) ?? $event;
                $user = \App\Models\User::find($event->user_id);
                if (!$user) continue;
                DB::table('notifications')->insert([
                    'id' => \Illuminate\Support\Str::uuid(),
                    'type' => 'App\\Notifications\\CommissionGenerated',
                    'notifiable_type' => 'App\\Models\\User',
                    'notifiable_id' => $user->id,
                    'data' => json_encode([
                        'title' => 'Nova Comissão Gerada',
                        'message' => "Comissão de R$ " . number_format($event->commission_amount, 2, ',', '.') . " gerada para a OS #" . ($loaded->workOrder?->os_number ?? $loaded->workOrder?->number ?? $event->work_order_id),
                        'type' => 'commission',
                        'event_id' => $event->id,
                    ]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        } catch (\Throwable) {
            // Notifications are non-critical
        }
    }

    private function notifyStatusChange(object $event, string $oldStatus, string $newStatus): void
    {
        try {
            $statusInfo = CommissionEvent::STATUSES[$newStatus] ?? null;
            $label = $statusInfo ? mb_strtolower($statusInfo['label']) : $newStatus;
            $amount = $event->commission_amount ?? 0;

            DB::table('notifications')->insert([
                'id' => \Illuminate\Support\Str::uuid(),
                'type' => 'App\\Notifications\\CommissionStatusChanged',
                'notifiable_type' => 'App\\Models\\User',
                'notifiable_id' => $event->user_id,
                'data' => json_encode([
                    'title' => 'Comissão ' . ucfirst($label),
                    'message' => "Sua comissão de R$ " . number_format($amount, 2, ',', '.') . " foi {$label}.",
                    'type' => 'commission',
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable) {
            // Notifications are non-critical
        }
    }
}
