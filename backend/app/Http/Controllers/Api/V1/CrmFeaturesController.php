<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ScopesByRole;
use App\Models\CrmCalendarEvent;
use App\Models\CrmContractRenewal;
use App\Models\CrmDeal;
use App\Models\CrmDealCompetitor;
use App\Models\CrmForecastSnapshot;
use App\Models\CrmInteractiveProposal;
use App\Models\CrmLeadScore;
use App\Models\CrmLeadScoringRule;
use App\Models\CrmLossReason;
use App\Models\CrmReferral;
use App\Models\CrmSalesGoal;
use App\Models\CrmSequence;
use App\Models\CrmSequenceEnrollment;
use App\Models\CrmSequenceStep;
use App\Models\CrmSmartAlert;
use App\Models\CrmTerritory;
use App\Models\CrmTerritoryMember;
use App\Models\CrmTrackingEvent;
use App\Models\CrmWebForm;
use App\Models\CrmWebFormSubmission;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\CrmActivity;
use App\Models\CrmPipeline;
use App\Models\AccountReceivable;
use App\Models\Quote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CrmFeaturesController extends Controller
{
    use ScopesByRole;

    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════
    // 1. LEAD SCORING
    // ═══════════════════════════════════════════════════════

    public function scoringRules(Request $request): JsonResponse
    {
        $rules = CrmLeadScoringRule::where('tenant_id', $this->tenantId($request))
            ->orderBy('sort_order')
            ->get();

        return response()->json($rules);
    }

    public function storeScoringRule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'field' => 'required|string|max:100',
            'operator' => ['required', Rule::in(CrmLeadScoringRule::OPERATORS)],
            'value' => 'required|string|max:500',
            'points' => 'required|integer|min:-100|max:100',
            'category' => ['required', Rule::in(array_keys(CrmLeadScoringRule::CATEGORIES))],
        ]);

        $rule = CrmLeadScoringRule::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
        ]);

        return response()->json($rule, 201);
    }

    public function updateScoringRule(Request $request, CrmLeadScoringRule $rule): JsonResponse
    {
        $data = $request->validate([
            'name' => 'string|max:255',
            'field' => 'string|max:100',
            'operator' => [Rule::in(CrmLeadScoringRule::OPERATORS)],
            'value' => 'string|max:500',
            'points' => 'integer|min:-100|max:100',
            'category' => [Rule::in(array_keys(CrmLeadScoringRule::CATEGORIES))],
            'is_active' => 'boolean',
        ]);

        $rule->update($data);
        return response()->json($rule);
    }

    public function destroyScoringRule(CrmLeadScoringRule $rule): JsonResponse
    {
        try {
            $rule->delete();
            return response()->json(['message' => 'Regra removida']);
        } catch (\Exception $e) {
            Log::error('CrmFeatures destroyScoringRule failed', ['rule_id' => $rule->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover regra'], 500);
        }
    }

    public function calculateScores(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $rules = CrmLeadScoringRule::where('tenant_id', $tenantId)->active()->get();
        $customers = Customer::where('tenant_id', $tenantId)->where('is_active', true)->get();

        $calculated = 0;
        foreach ($customers as $customer) {
            $totalScore = 0;
            $breakdown = [];

            foreach ($rules as $rule) {
                $fieldValue = $customer->{$rule->field} ?? null;
                $matches = $this->evaluateScoringRule($rule, $fieldValue);

                if ($matches) {
                    $totalScore += $rule->points;
                    $breakdown[] = [
                        'rule_id' => $rule->id,
                        'rule_name' => $rule->name,
                        'points' => $rule->points,
                        'field' => $rule->field,
                    ];
                }
            }

            $grade = CrmLeadScore::calculateGrade($totalScore);

            CrmLeadScore::updateOrCreate(
                ['tenant_id' => $tenantId, 'customer_id' => $customer->id],
                [
                    'total_score' => $totalScore,
                    'score_breakdown' => $breakdown,
                    'grade' => $grade,
                    'calculated_at' => now(),
                ]
            );

            $customer->update(['lead_score' => $totalScore, 'lead_grade' => $grade]);
            $calculated++;
        }

        return response()->json(['message' => "Scores calculados para {$calculated} clientes"]);
    }

    public function leaderboard(Request $request): JsonResponse
    {
        $scores = CrmLeadScore::where('tenant_id', $this->tenantId($request))
            ->with('customer:id,name,email,phone,segment,health_score')
            ->orderByDesc('total_score')
            ->paginate($request->input('per_page', 50));

        return response()->json($scores);
    }

    private function evaluateScoringRule(CrmLeadScoringRule $rule, $value): bool
    {
        $ruleValue = $rule->value;

        return match ($rule->operator) {
            'equals' => (string) $value === $ruleValue,
            'not_equals' => (string) $value !== $ruleValue,
            'greater_than' => is_numeric($value) && $value > (float) $ruleValue,
            'less_than' => is_numeric($value) && $value < (float) $ruleValue,
            'contains' => str_contains((string) $value, $ruleValue),
            'in' => in_array((string) $value, explode(',', $ruleValue)),
            'not_in' => !in_array((string) $value, explode(',', $ruleValue)),
            'between' => $this->evaluateBetween($value, $ruleValue),
            default => false,
        };
    }

    private function evaluateBetween($value, string $range): bool
    {
        $parts = explode(',', $range);
        if (count($parts) !== 2 || !is_numeric($value)) return false;
        return $value >= (float) $parts[0] && $value <= (float) $parts[1];
    }

    // ═══════════════════════════════════════════════════════
    // 2. SALES SEQUENCES (CADENCES)
    // ═══════════════════════════════════════════════════════

    public function sequences(Request $request): JsonResponse
    {
        $sequences = CrmSequence::where('tenant_id', $this->tenantId($request))
            ->with('steps')
            ->withCount('enrollments')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($sequences);
    }

    public function showSequence(CrmSequence $sequence): JsonResponse
    {
        $sequence->load(['steps' => fn($q) => $q->orderBy('step_order'), 'enrollments.customer:id,name']);
        return response()->json($sequence);
    }

    public function storeSequence(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'steps' => 'required|array|min:1',
            'steps.*.step_order' => 'required|integer',
            'steps.*.delay_days' => 'required|integer|min:0',
            'steps.*.channel' => 'required|string',
            'steps.*.action_type' => ['required', Rule::in(CrmSequenceStep::ACTION_TYPES)],
            'steps.*.template_id' => 'nullable|integer',
            'steps.*.subject' => 'nullable|string',
            'steps.*.body' => 'nullable|string',
        ]);

        $sequence = DB::transaction(function () use ($data, $request) {
            $sequence = CrmSequence::create([
                'tenant_id' => $this->tenantId($request),
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'total_steps' => count($data['steps']),
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['steps'] as $step) {
                $sequence->steps()->create($step);
            }

            return $sequence;
        });

        return response()->json($sequence->load('steps'), 201);
    }

    public function updateSequence(Request $request, CrmSequence $sequence): JsonResponse
    {
        $data = $request->validate([
            'name' => 'string|max:255',
            'description' => 'nullable|string',
            'status' => [Rule::in(array_keys(CrmSequence::STATUSES))],
        ]);

        $sequence->update($data);
        return response()->json($sequence);
    }

    public function destroySequence(CrmSequence $sequence): JsonResponse
    {
        try {
            $sequence->enrollments()->where('status', 'active')->update(['status' => 'cancelled']);
            $sequence->delete();
            return response()->json(['message' => 'Cadência removida']);
        } catch (\Exception $e) {
            Log::error('CrmFeatures destroySequence failed', ['sequence_id' => $sequence->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover cadência'], 500);
        }
    }

    public function enrollInSequence(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sequence_id' => 'required|exists:crm_sequences,id',
            'customer_id' => 'required|exists:customers,id',
            'deal_id' => 'nullable|exists:crm_deals,id',
        ]);

        $existing = CrmSequenceEnrollment::where('sequence_id', $data['sequence_id'])
            ->where('customer_id', $data['customer_id'])
            ->active()
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Cliente já inscrito nesta cadência'], 422);
        }

        $sequence = CrmSequence::findOrFail($data['sequence_id']);
        $firstStep = $sequence->steps()->orderBy('step_order')->first();

        $enrollment = CrmSequenceEnrollment::create([
            'tenant_id' => $this->tenantId($request),
            'sequence_id' => $data['sequence_id'],
            'customer_id' => $data['customer_id'],
            'deal_id' => $data['deal_id'] ?? null,
            'current_step' => 0,
            'next_action_at' => now()->addDays($firstStep?->delay_days ?? 0),
            'enrolled_by' => $request->user()->id,
        ]);

        return response()->json($enrollment, 201);
    }

    public function unenrollFromSequence(CrmSequenceEnrollment $enrollment): JsonResponse
    {
        $enrollment->update(['status' => 'cancelled']);
        return response()->json(['message' => 'Inscrição cancelada']);
    }

    // ═══════════════════════════════════════════════════════
    // 3. SALES FORECASTING
    // ═══════════════════════════════════════════════════════

    public function forecast(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $periodType = $request->input('period', 'monthly');
        $months = $request->input('months', 3);

        $forecast = [];
        for ($i = 0; $i < $months; $i++) {
            $start = now()->addMonths($i)->startOfMonth();
            $end = now()->addMonths($i)->endOfMonth();

            $openDeals = CrmDeal::where('tenant_id', $tenantId)
                ->open()
                ->where(function ($q) use ($start, $end) {
                    $q->whereBetween('expected_close_date', [$start, $end])
                        ->orWhereNull('expected_close_date');
                })
                ->get();

            $pipelineValue = $openDeals->sum('value');
            $weightedValue = $openDeals->sum(fn($d) => $d->value * ($d->probability / 100));

            $historicalWinRate = $this->historicalWinRate($tenantId, 6);
            $bestCase = $pipelineValue * min($historicalWinRate * 1.2, 1);
            $worstCase = $weightedValue * 0.7;
            $committed = $openDeals->where('probability', '>=', 80)->sum('value');

            $byStage = $openDeals->groupBy('stage_id')->map(fn($deals) => [
                'count' => $deals->count(),
                'value' => $deals->sum('value'),
                'weighted' => $deals->sum(fn($d) => $d->value * ($d->probability / 100)),
            ]);

            $byUser = $openDeals->groupBy('assigned_to')->map(fn($deals) => [
                'count' => $deals->count(),
                'value' => $deals->sum('value'),
            ]);

            $forecast[] = [
                'period_start' => $start->toDateString(),
                'period_end' => $end->toDateString(),
                'pipeline_value' => round($pipelineValue, 2),
                'weighted_value' => round($weightedValue, 2),
                'best_case' => round($bestCase, 2),
                'worst_case' => round($worstCase, 2),
                'committed' => round($committed, 2),
                'deal_count' => $openDeals->count(),
                'historical_win_rate' => round($historicalWinRate * 100, 1),
                'by_stage' => $byStage,
                'by_user' => $byUser,
            ];
        }

        $wonLast12 = CrmDeal::where('tenant_id', $tenantId)
            ->won()
            ->where('won_at', '>=', now()->subMonths(12))
            ->selectRaw('DATE_FORMAT(won_at, "%Y-%m") as month, SUM(value) as total, COUNT(*) as count')
            ->groupByRaw('DATE_FORMAT(won_at, "%Y-%m")')
            ->orderBy('month')
            ->get();

        return response()->json([
            'forecast' => $forecast,
            'historical_won' => $wonLast12,
            'period_type' => $periodType,
        ]);
    }

    public function snapshotForecast(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $start = now()->startOfMonth();
        $end = now()->endOfMonth();

        $openDeals = CrmDeal::where('tenant_id', $tenantId)->open()->get();
        $pipelineValue = $openDeals->sum('value');
        $weightedValue = $openDeals->sum(fn($d) => $d->value * ($d->probability / 100));
        $committed = $openDeals->where('probability', '>=', 80)->sum('value');
        $historicalWinRate = $this->historicalWinRate($tenantId, 6);

        $wonThisMonth = CrmDeal::where('tenant_id', $tenantId)
            ->won()
            ->where('won_at', '>=', $start)
            ->get();

        CrmForecastSnapshot::create([
            'tenant_id' => $tenantId,
            'snapshot_date' => now()->toDateString(),
            'period_type' => 'monthly',
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'pipeline_value' => $pipelineValue,
            'weighted_value' => $weightedValue,
            'best_case' => $pipelineValue * min($historicalWinRate * 1.2, 1),
            'worst_case' => $weightedValue * 0.7,
            'committed' => $committed,
            'deal_count' => $openDeals->count(),
            'won_value' => $wonThisMonth->sum('value'),
            'won_count' => $wonThisMonth->count(),
        ]);

        return response()->json(['message' => 'Snapshot criado']);
    }

    private function historicalWinRate(int $tenantId, int $months): float
    {
        $since = now()->subMonths($months);
        $won = CrmDeal::where('tenant_id', $tenantId)->won()->where('won_at', '>=', $since)->count();
        $lost = CrmDeal::where('tenant_id', $tenantId)->lost()->where('lost_at', '>=', $since)->count();
        $total = $won + $lost;
        return $total > 0 ? $won / $total : 0.3;
    }

    // ═══════════════════════════════════════════════════════
    // 4. SMART ALERTS
    // ═══════════════════════════════════════════════════════

    public function smartAlerts(Request $request): JsonResponse
    {
        $alerts = CrmSmartAlert::where('tenant_id', $this->tenantId($request))
            ->with(['customer:id,name', 'deal:id,title', 'equipment:id,code,brand,model', 'assignee:id,name'])
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->when($request->input('type'), fn($q, $t) => $q->where('type', $t))
            ->when($request->input('priority'), fn($q, $p) => $q->where('priority', $p))
            ->orderByRaw("FIELD(priority, 'critical', 'high', 'medium', 'low')")
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 30));

        return response()->json($alerts);
    }

    public function acknowledgeAlert(CrmSmartAlert $alert): JsonResponse
    {
        $alert->update(['status' => 'acknowledged', 'acknowledged_at' => now()]);
        return response()->json($alert);
    }

    public function resolveAlert(CrmSmartAlert $alert): JsonResponse
    {
        $alert->update(['status' => 'resolved', 'resolved_at' => now()]);
        return response()->json($alert);
    }

    public function dismissAlert(CrmSmartAlert $alert): JsonResponse
    {
        $alert->update(['status' => 'dismissed']);
        return response()->json(['message' => 'Alerta descartado']);
    }

    public function generateSmartAlerts(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $generated = 0;

        // Calibrações vencendo em 60 dias
        $expiringEquipments = Equipment::where('tenant_id', $tenantId)
            ->whereNotNull('next_calibration_at')
            ->where('next_calibration_at', '<=', now()->addDays(60))
            ->where('next_calibration_at', '>=', now())
            ->get();

        foreach ($expiringEquipments as $eq) {
            $exists = CrmSmartAlert::where('tenant_id', $tenantId)
                ->where('type', 'calibration_expiring')
                ->where('equipment_id', $eq->id)
                ->where('status', 'pending')
                ->exists();

            if (!$exists) {
                CrmSmartAlert::create([
                    'tenant_id' => $tenantId,
                    'type' => 'calibration_expiring',
                    'priority' => 'high',
                    'title' => "Calibração vencendo: {$eq->code}",
                    'description' => "Equipamento {$eq->brand} {$eq->model} do cliente vence em " . $eq->next_calibration_at->format('d/m/Y'),
                    'customer_id' => $eq->customer_id,
                    'equipment_id' => $eq->id,
                    'metadata' => ['expiry_date' => $eq->next_calibration_at->toDateString()],
                ]);
                $generated++;
            }
        }

        // Deals parados há mais de 15 dias
        $stalledDeals = CrmDeal::where('tenant_id', $tenantId)
            ->open()
            ->where('updated_at', '<=', now()->subDays(15))
            ->get();

        foreach ($stalledDeals as $deal) {
            $exists = CrmSmartAlert::where('tenant_id', $tenantId)
                ->where('type', 'deal_stalled')
                ->where('deal_id', $deal->id)
                ->where('status', 'pending')
                ->exists();

            if (!$exists) {
                CrmSmartAlert::create([
                    'tenant_id' => $tenantId,
                    'type' => 'deal_stalled',
                    'priority' => 'medium',
                    'title' => "Deal parado: {$deal->title}",
                    'description' => "Sem atividade há " . now()->diffInDays($deal->updated_at) . " dias",
                    'customer_id' => $deal->customer_id,
                    'deal_id' => $deal->id,
                    'assigned_to' => $deal->assigned_to,
                ]);
                $generated++;
            }
        }

        // Clientes sem contato há 90+ dias com health score caindo
        $noContact = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where(function ($q) {
                $q->where('last_contact_at', '<=', now()->subDays(90))
                    ->orWhereNull('last_contact_at');
            })
            ->get();

        foreach ($noContact as $customer) {
            $exists = CrmSmartAlert::where('tenant_id', $tenantId)
                ->where('type', 'no_contact')
                ->where('customer_id', $customer->id)
                ->where('status', 'pending')
                ->exists();

            if (!$exists) {
                CrmSmartAlert::create([
                    'tenant_id' => $tenantId,
                    'type' => 'no_contact',
                    'priority' => $customer->health_score < 50 ? 'high' : 'medium',
                    'title' => "Sem contato: {$customer->name}",
                    'description' => 'Cliente sem contato há mais de 90 dias',
                    'customer_id' => $customer->id,
                    'assigned_to' => $customer->assigned_seller_id,
                ]);
                $generated++;
            }
        }

        // Contratos vencendo
        $expiringContracts = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereNotNull('contract_end')
            ->where('contract_end', '<=', now()->addDays(60))
            ->where('contract_end', '>=', now())
            ->get();

        foreach ($expiringContracts as $customer) {
            $exists = CrmSmartAlert::where('tenant_id', $tenantId)
                ->where('type', 'contract_expiring')
                ->where('customer_id', $customer->id)
                ->where('status', 'pending')
                ->exists();

            if (!$exists) {
                CrmSmartAlert::create([
                    'tenant_id' => $tenantId,
                    'type' => 'contract_expiring',
                    'priority' => 'high',
                    'title' => "Contrato vencendo: {$customer->name}",
                    'description' => 'Contrato vence em ' . $customer->contract_end->format('d/m/Y'),
                    'customer_id' => $customer->id,
                    'assigned_to' => $customer->assigned_seller_id,
                    'metadata' => ['contract_end' => $customer->contract_end->toDateString()],
                ]);
                $generated++;
            }
        }

        return response()->json(['message' => "{$generated} alertas gerados"]);
    }

    // ═══════════════════════════════════════════════════════
    // 5. CROSS-SELL / UP-SELL RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════

    public function crossSellRecommendations(Request $request, int $customerId): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $customer = Customer::where('tenant_id', $tenantId)->findOrFail($customerId);

        $customerEquipCount = Equipment::where('customer_id', $customerId)->count();
        $calibratedCount = Equipment::where('customer_id', $customerId)
            ->whereNotNull('last_calibration_at')
            ->count();

        $recommendations = [];

        // Equipamentos não calibrados
        if ($customerEquipCount > $calibratedCount) {
            $uncalibrated = $customerEquipCount - $calibratedCount;
            $recommendations[] = [
                'type' => 'cross_sell',
                'title' => "Calibrar {$uncalibrated} equipamento(s) pendente(s)",
                'description' => "Cliente possui {$customerEquipCount} equipamentos mas apenas {$calibratedCount} são calibrados regularmente.",
                'estimated_value' => $uncalibrated * 150,
                'priority' => 'high',
            ];
        }

        // Upgrade para contrato
        if (empty($customer->contract_type) || $customer->contract_type === 'avulso') {
            $annualSpend = CrmDeal::where('tenant_id', $tenantId)
                ->where('customer_id', $customerId)
                ->won()
                ->where('won_at', '>=', now()->subYear())
                ->sum('value');

            if ($annualSpend > 1000) {
                $recommendations[] = [
                    'type' => 'up_sell',
                    'title' => 'Propor contrato anual',
                    'description' => "Cliente gasta R$ " . number_format($annualSpend, 2, ',', '.') . "/ano em serviços avulsos. Contrato anual pode economizar 15-20%.",
                    'estimated_value' => $annualSpend * 0.85,
                    'priority' => 'high',
                ];
            }
        }

        // Serviços similares a clientes do mesmo segmento
        $segment = $customer->segment;
        if ($segment) {
            $popularServices = CrmDeal::where('tenant_id', $tenantId)
                ->whereHas('customer', fn($q) => $q->where('segment', $segment)->where('id', '!=', $customerId))
                ->won()
                ->where('won_at', '>=', now()->subYear())
                ->select('source', DB::raw('COUNT(*) as cnt'), DB::raw('AVG(value) as avg_value'))
                ->groupBy('source')
                ->orderByDesc('cnt')
                ->limit(3)
                ->get();

            foreach ($popularServices as $svc) {
                $customerHas = CrmDeal::where('tenant_id', $tenantId)
                    ->where('customer_id', $customerId)
                    ->where('source', $svc->source)
                    ->won()
                    ->exists();

                if (!$customerHas && $svc->source) {
                    $recommendations[] = [
                        'type' => 'cross_sell',
                        'title' => "Serviço popular no segmento: " . (CrmDeal::SOURCES[$svc->source] ?? $svc->source),
                        'description' => "{$svc->cnt} clientes do mesmo segmento utilizam este serviço.",
                        'estimated_value' => round($svc->avg_value, 2),
                        'priority' => 'medium',
                    ];
                }
            }
        }

        return response()->json($recommendations);
    }

    // ═══════════════════════════════════════════════════════
    // 6. LOSS REASONS
    // ═══════════════════════════════════════════════════════

    public function lossReasons(Request $request): JsonResponse
    {
        $reasons = CrmLossReason::where('tenant_id', $this->tenantId($request))
            ->orderBy('sort_order')
            ->get();

        return response()->json($reasons);
    }

    public function storeLossReason(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category' => ['required', Rule::in(array_keys(CrmLossReason::CATEGORIES))],
        ]);

        $reason = CrmLossReason::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
        ]);

        return response()->json($reason, 201);
    }

    public function updateLossReason(Request $request, CrmLossReason $reason): JsonResponse
    {
        $reason->update($request->validate([
            'name' => 'string|max:255',
            'category' => [Rule::in(array_keys(CrmLossReason::CATEGORIES))],
            'is_active' => 'boolean',
        ]));

        return response()->json($reason);
    }

    public function lossAnalytics(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $months = $request->input('months', 6);
        $since = now()->subMonths($months);

        try {
            $byReason = CrmDeal::where('crm_deals.tenant_id', $tenantId)
                ->where('crm_deals.status', CrmDeal::STATUS_LOST)
                ->where('crm_deals.lost_at', '>=', $since)
                ->whereNotNull('crm_deals.loss_reason_id')
                ->whereNull('crm_deals.deleted_at')
                ->join('crm_loss_reasons', 'crm_deals.loss_reason_id', '=', 'crm_loss_reasons.id')
                ->select('crm_loss_reasons.name', 'crm_loss_reasons.category',
                    DB::raw('COUNT(*) as count'), DB::raw('SUM(crm_deals.value) as total_value'))
                ->groupBy('crm_loss_reasons.name', 'crm_loss_reasons.category')
                ->orderByDesc('count')
                ->get();

            $byCompetitor = CrmDeal::where('crm_deals.tenant_id', $tenantId)
                ->lost()
                ->where('lost_at', '>=', $since)
                ->whereNotNull('competitor_name')
                ->select('competitor_name',
                    DB::raw('COUNT(*) as count'), DB::raw('SUM(value) as total_value'),
                    DB::raw('AVG(competitor_price) as avg_competitor_price'))
                ->groupBy('competitor_name')
                ->orderByDesc('count')
                ->get();

            $byUser = CrmDeal::where('crm_deals.tenant_id', $tenantId)
                ->where('crm_deals.status', CrmDeal::STATUS_LOST)
                ->where('crm_deals.lost_at', '>=', $since)
                ->whereNull('crm_deals.deleted_at')
                ->join('users', 'crm_deals.assigned_to', '=', 'users.id')
                ->select('users.name', DB::raw('COUNT(*) as count'), DB::raw('SUM(crm_deals.value) as total_value'))
                ->groupBy('users.name')
                ->orderByDesc('count')
                ->get();

            $monthlyTrend = CrmDeal::where('tenant_id', $tenantId)
                ->lost()
                ->where('lost_at', '>=', $since)
                ->selectRaw('DATE_FORMAT(lost_at, "%Y-%m") as month, COUNT(*) as count, SUM(value) as total_value')
                ->groupByRaw('DATE_FORMAT(lost_at, "%Y-%m")')
                ->orderBy('month')
                ->get();
        } catch (\Exception $e) {
            Log::warning('CrmFeatures lossAnalytics query failed', ['error' => $e->getMessage()]);

            return response()->json([
                'by_reason' => [],
                'by_competitor' => [],
                'by_user' => [],
                'monthly_trend' => [],
            ]);
        }

        return response()->json([
            'by_reason' => $byReason,
            'by_competitor' => $byCompetitor,
            'by_user' => $byUser,
            'monthly_trend' => $monthlyTrend,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 7. TERRITORIES
    // ═══════════════════════════════════════════════════════

    public function territories(Request $request): JsonResponse
    {
        $territories = CrmTerritory::where('tenant_id', $this->tenantId($request))
            ->with(['manager:id,name', 'members.user:id,name'])
            ->withCount('customers')
            ->orderBy('name')
            ->get();

        return response()->json($territories);
    }

    public function storeTerritory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'regions' => 'nullable|array',
            'zip_code_ranges' => 'nullable|array',
            'manager_id' => 'nullable|exists:users,id',
            'member_ids' => 'nullable|array',
            'member_ids.*' => 'exists:users,id',
        ]);

        $territory = DB::transaction(function () use ($data, $request) {
            $territory = CrmTerritory::create([
                'tenant_id' => $this->tenantId($request),
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'regions' => $data['regions'] ?? null,
                'zip_code_ranges' => $data['zip_code_ranges'] ?? null,
                'manager_id' => $data['manager_id'] ?? null,
            ]);

            if (!empty($data['member_ids'])) {
                foreach ($data['member_ids'] as $userId) {
                    CrmTerritoryMember::create([
                        'territory_id' => $territory->id,
                        'user_id' => $userId,
                    ]);
                }
            }

            return $territory;
        });

        return response()->json($territory->load('members.user:id,name'), 201);
    }

    public function updateTerritory(Request $request, CrmTerritory $territory): JsonResponse
    {
        $data = $request->validate([
            'name' => 'string|max:255',
            'description' => 'nullable|string',
            'regions' => 'nullable|array',
            'zip_code_ranges' => 'nullable|array',
            'manager_id' => 'nullable|exists:users,id',
            'is_active' => 'boolean',
            'member_ids' => 'nullable|array',
            'member_ids.*' => 'exists:users,id',
        ]);

        DB::transaction(function () use ($territory, $data) {
            $territory->update(collect($data)->except('member_ids')->toArray());

            if (isset($data['member_ids'])) {
                $territory->members()->delete();
                foreach ($data['member_ids'] as $userId) {
                    CrmTerritoryMember::create([
                        'territory_id' => $territory->id,
                        'user_id' => $userId,
                    ]);
                }
            }
        });

        return response()->json($territory->load('members.user:id,name'));
    }

    public function destroyTerritory(CrmTerritory $territory): JsonResponse
    {
        try {
            $territory->delete();
            return response()->json(['message' => 'Território removido']);
        } catch (\Exception $e) {
            Log::error('CrmFeatures destroyTerritory failed', ['territory_id' => $territory->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover território'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════
    // 8. SALES GOALS (QUOTAS)
    // ═══════════════════════════════════════════════════════

    public function salesGoals(Request $request): JsonResponse
    {
        $goals = CrmSalesGoal::where('tenant_id', $this->tenantId($request))
            ->with(['user:id,name', 'territory:id,name'])
            ->when($request->input('user_id'), fn($q, $id) => $q->where('user_id', $id))
            ->when($request->input('period_type'), fn($q, $p) => $q->where('period_type', $p))
            ->orderByDesc('period_start')
            ->paginate($request->input('per_page', 20));

        return response()->json($goals);
    }

    public function storeSalesGoal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'territory_id' => 'nullable|exists:crm_territories,id',
            'period_type' => ['required', Rule::in(array_keys(CrmSalesGoal::PERIOD_TYPES))],
            'period_start' => 'required|date',
            'period_end' => 'required|date|after:period_start',
            'target_revenue' => 'required|numeric|min:0',
            'target_deals' => 'required|integer|min:0',
            'target_new_customers' => 'integer|min:0',
            'target_activities' => 'integer|min:0',
        ]);

        $goal = CrmSalesGoal::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
        ]);

        return response()->json($goal, 201);
    }

    public function updateSalesGoal(Request $request, CrmSalesGoal $goal): JsonResponse
    {
        $goal->update($request->validate([
            'target_revenue' => 'numeric|min:0',
            'target_deals' => 'integer|min:0',
            'target_new_customers' => 'integer|min:0',
            'target_activities' => 'integer|min:0',
        ]));

        return response()->json($goal);
    }

    public function recalculateGoals(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $goals = CrmSalesGoal::where('tenant_id', $tenantId)
            ->where('period_end', '>=', now())
            ->get();

        foreach ($goals as $goal) {
            $query = CrmDeal::where('tenant_id', $tenantId)
                ->when($goal->user_id, fn($q, $uid) => $q->where('assigned_to', $uid));

            $goal->achieved_revenue = (float) $query->clone()->won()
                ->whereBetween('won_at', [$goal->period_start, $goal->period_end])
                ->sum('value');

            $goal->achieved_deals = $query->clone()->won()
                ->whereBetween('won_at', [$goal->period_start, $goal->period_end])
                ->count();

            $goal->achieved_new_customers = Customer::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$goal->period_start, $goal->period_end])
                ->when($goal->user_id, fn($q, $uid) => $q->where('assigned_seller_id', $uid))
                ->count();

            $goal->achieved_activities = CrmActivity::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$goal->period_start, $goal->period_end])
                ->when($goal->user_id, fn($q, $uid) => $q->where('user_id', $uid))
                ->whereNotNull('completed_at')
                ->count();

            $goal->save();
        }

        return response()->json(['message' => 'Metas recalculadas', 'count' => $goals->count()]);
    }

    public function goalsDashboard(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $currentGoals = CrmSalesGoal::where('tenant_id', $tenantId)
            ->where('period_start', '<=', now())
            ->where('period_end', '>=', now())
            ->with(['user:id,name', 'territory:id,name'])
            ->get();

        $ranking = $currentGoals->where('user_id', '!=', null)->map(fn($g) => [
            'user' => $g->user,
            'revenue_progress' => $g->revenueProgress(),
            'deals_progress' => $g->dealsProgress(),
            'target_revenue' => $g->target_revenue,
            'achieved_revenue' => $g->achieved_revenue,
            'target_deals' => $g->target_deals,
            'achieved_deals' => $g->achieved_deals,
        ])->sortByDesc('revenue_progress')->values();

        return response()->json([
            'goals' => $currentGoals,
            'ranking' => $ranking,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 9. PIPELINE VELOCITY
    // ═══════════════════════════════════════════════════════

    public function pipelineVelocity(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $months = $request->input('months', 6);
        $pipelineId = $request->input('pipeline_id');

        $since = now()->subMonths($months);

        $wonDeals = CrmDeal::where('tenant_id', $tenantId)
            ->won()
            ->where('won_at', '>=', $since)
            ->when($pipelineId, fn($q, $pid) => $q->where('pipeline_id', $pid))
            ->get();

        $avgCycleDays = $wonDeals->avg(fn($d) => $d->created_at->diffInDays($d->won_at));
        $avgValue = $wonDeals->avg('value');

        // Stage duration from activities
        $stageMetrics = DB::table('crm_activities')
            ->where('crm_activities.tenant_id', $tenantId)
            ->where('crm_activities.type', 'system')
            ->where('crm_activities.title', 'like', '%movido%estágio%')
            ->where('crm_activities.created_at', '>=', $since)
            ->select(
                DB::raw('COUNT(*) as transitions'),
                DB::raw('AVG(duration_minutes) as avg_duration')
            )
            ->first();

        // Win rate by stage
        $pipeline = $pipelineId
            ? CrmPipeline::with('stages')->find($pipelineId)
            : CrmPipeline::where('tenant_id', $tenantId)->active()->default()->with('stages')->first();

        $stageAnalysis = [];
        if ($pipeline) {
            foreach ($pipeline->stages as $stage) {
                $dealsInStage = CrmDeal::where('tenant_id', $tenantId)
                    ->where('pipeline_id', $pipeline->id)
                    ->where('stage_id', $stage->id)
                    ->count();

                $dealsPassedThrough = CrmDeal::where('tenant_id', $tenantId)
                    ->where('pipeline_id', $pipeline->id)
                    ->won()
                    ->where('won_at', '>=', $since)
                    ->count();

                $stageAnalysis[] = [
                    'stage_id' => $stage->id,
                    'stage_name' => $stage->name,
                    'color' => $stage->color,
                    'current_deals' => $dealsInStage,
                    'current_value' => CrmDeal::where('tenant_id', $tenantId)
                        ->where('stage_id', $stage->id)->open()->sum('value'),
                ];
            }
        }

        return response()->json([
            'avg_cycle_days' => round($avgCycleDays ?? 0, 1),
            'avg_deal_value' => round($avgValue ?? 0, 2),
            'total_won' => $wonDeals->count(),
            'total_won_value' => $wonDeals->sum('value'),
            'velocity' => $avgCycleDays > 0
                ? round(($wonDeals->count() * ($avgValue ?? 0)) / $avgCycleDays, 2)
                : 0,
            'stage_analysis' => $stageAnalysis,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 10. CONTRACT RENEWALS
    // ═══════════════════════════════════════════════════════

    public function contractRenewals(Request $request): JsonResponse
    {
        $renewals = CrmContractRenewal::where('tenant_id', $this->tenantId($request))
            ->with(['customer:id,name,contract_end,contract_type', 'deal:id,title,status'])
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->orderBy('contract_end_date')
            ->paginate($request->input('per_page', 20));

        return response()->json($renewals);
    }

    public function generateRenewals(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $generated = 0;

        $customers = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereNotNull('contract_end')
            ->where('contract_end', '<=', now()->addDays(90))
            ->where('contract_end', '>=', now())
            ->get();

        foreach ($customers as $customer) {
            $exists = CrmContractRenewal::where('tenant_id', $tenantId)
                ->where('customer_id', $customer->id)
                ->whereIn('status', ['pending', 'notified', 'in_negotiation'])
                ->exists();

            if (!$exists) {
                $lastDealValue = CrmDeal::where('customer_id', $customer->id)
                    ->won()
                    ->latest('won_at')
                    ->value('value') ?? 0;

                $renewal = CrmContractRenewal::create([
                    'tenant_id' => $tenantId,
                    'customer_id' => $customer->id,
                    'contract_end_date' => $customer->contract_end,
                    'current_value' => $lastDealValue,
                    'status' => 'pending',
                ]);

                // Auto-create deal
                $defaultPipeline = CrmPipeline::where('tenant_id', $tenantId)->default()->first();
                if ($defaultPipeline) {
                    $firstStage = $defaultPipeline->stages()->orderBy('sort_order')->first();
                    if ($firstStage) {
                        $deal = CrmDeal::create([
                            'tenant_id' => $tenantId,
                            'customer_id' => $customer->id,
                            'pipeline_id' => $defaultPipeline->id,
                            'stage_id' => $firstStage->id,
                            'title' => "Renovação - {$customer->name}",
                            'value' => $lastDealValue,
                            'source' => 'contrato_renovacao',
                            'assigned_to' => $customer->assigned_seller_id,
                            'expected_close_date' => $customer->contract_end,
                        ]);
                        $renewal->update(['deal_id' => $deal->id]);
                    }
                }

                $generated++;
            }
        }

        return response()->json(['message' => "{$generated} renovações geradas"]);
    }

    public function updateRenewal(Request $request, CrmContractRenewal $renewal): JsonResponse
    {
        $renewal->update($request->validate([
            'status' => [Rule::in(array_keys(CrmContractRenewal::STATUSES))],
            'renewal_value' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]));

        if ($request->input('status') === 'renewed') {
            $renewal->update(['renewed_at' => now()]);
        }

        return response()->json($renewal);
    }

    // ═══════════════════════════════════════════════════════
    // 11. WEB FORMS (Lead Capture)
    // ═══════════════════════════════════════════════════════

    public function webForms(Request $request): JsonResponse
    {
        $forms = CrmWebForm::where('tenant_id', $this->tenantId($request))
            ->withCount('submissions')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($forms);
    }

    public function storeWebForm(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'fields' => 'required|array|min:1',
            'fields.*.name' => 'required|string',
            'fields.*.type' => 'required|string',
            'fields.*.label' => 'required|string',
            'fields.*.required' => 'boolean',
            'pipeline_id' => 'nullable|exists:crm_pipelines,id',
            'assign_to' => 'nullable|exists:users,id',
            'sequence_id' => 'nullable|exists:crm_sequences,id',
            'redirect_url' => 'nullable|url',
            'success_message' => 'nullable|string',
        ]);

        $form = CrmWebForm::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
            'slug' => Str::slug($data['name']) . '-' . Str::random(6),
        ]);

        return response()->json($form, 201);
    }

    public function updateWebForm(Request $request, CrmWebForm $form): JsonResponse
    {
        $form->update($request->validate([
            'name' => 'string|max:255',
            'description' => 'nullable|string',
            'fields' => 'array',
            'pipeline_id' => 'nullable|exists:crm_pipelines,id',
            'assign_to' => 'nullable|exists:users,id',
            'sequence_id' => 'nullable|exists:crm_sequences,id',
            'redirect_url' => 'nullable|url',
            'success_message' => 'nullable|string',
            'is_active' => 'boolean',
        ]));

        return response()->json($form);
    }

    public function destroyWebForm(CrmWebForm $form): JsonResponse
    {
        try {
            $form->delete();
            return response()->json(['message' => 'Formulário removido']);
        } catch (\Exception $e) {
            Log::error('CrmFeatures destroyWebForm failed', ['form_id' => $form->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover formulário'], 500);
        }
    }

    public function submitWebForm(Request $request, string $slug): JsonResponse
    {
        $form = CrmWebForm::where('slug', $slug)->active()->firstOrFail();

        $submission = DB::transaction(function () use ($form, $request) {
            $data = $request->all();

            // Create or find customer
            $customer = null;
            $email = $data['email'] ?? null;
            $phone = $data['phone'] ?? $data['telefone'] ?? null;

            if ($email || $phone) {
                $customer = Customer::where('tenant_id', $form->tenant_id)
                    ->when($email, fn($q) => $q->where('email', $email))
                    ->when(!$email && $phone, fn($q) => $q->where('phone', $phone))
                    ->first();

                if (!$customer) {
                    $customer = Customer::create([
                        'tenant_id' => $form->tenant_id,
                        'name' => $data['name'] ?? $data['nome'] ?? 'Lead Web Form',
                        'email' => $email,
                        'phone' => $phone,
                        'source' => 'web_form',
                        'assigned_seller_id' => $form->assign_to,
                    ]);
                }
            }

            // Create deal
            $deal = null;
            if ($form->pipeline_id && $customer) {
                $pipeline = CrmPipeline::find($form->pipeline_id);
                $firstStage = $pipeline?->stages()->orderBy('sort_order')->first();

                if ($pipeline && $firstStage) {
                    $deal = CrmDeal::create([
                        'tenant_id' => $form->tenant_id,
                        'customer_id' => $customer->id,
                        'pipeline_id' => $pipeline->id,
                        'stage_id' => $firstStage->id,
                        'title' => "Lead via formulário: " . ($customer->name ?? 'Web'),
                        'source' => 'prospeccao',
                        'assigned_to' => $form->assign_to,
                    ]);
                }
            }

            // Enroll in sequence
            if ($form->sequence_id && $customer) {
                $sequence = CrmSequence::find($form->sequence_id);
                $firstStep = $sequence?->steps()->orderBy('step_order')->first();

                CrmSequenceEnrollment::create([
                    'tenant_id' => $form->tenant_id,
                    'sequence_id' => $form->sequence_id,
                    'customer_id' => $customer->id,
                    'deal_id' => $deal?->id,
                    'next_action_at' => now()->addDays($firstStep?->delay_days ?? 0),
                ]);
            }

            $submission = CrmWebFormSubmission::create([
                'form_id' => $form->id,
                'customer_id' => $customer?->id,
                'deal_id' => $deal?->id,
                'data' => $data,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'utm_source' => $data['utm_source'] ?? null,
                'utm_medium' => $data['utm_medium'] ?? null,
                'utm_campaign' => $data['utm_campaign'] ?? null,
            ]);

            $form->increment('submissions_count');

            return $submission;
        });

        return response()->json([
            'message' => $form->success_message ?? 'Formulário enviado com sucesso!',
            'redirect_url' => $form->redirect_url,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 12. INTERACTIVE PROPOSALS
    // ═══════════════════════════════════════════════════════

    public function interactiveProposals(Request $request): JsonResponse
    {
        $query = CrmInteractiveProposal::where('tenant_id', $this->tenantId($request))
            ->with(['quote:id,quote_number,total,status', 'deal:id,title'])
            ->orderByDesc('created_at');

        if ($request->has('quote_id')) {
            $query->where('quote_id', (int) $request->input('quote_id'));
        }

        $proposals = $query->paginate($request->input('per_page', 20));

        return response()->json($proposals);
    }

    public function createInteractiveProposal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'quote_id' => 'required|exists:quotes,id',
            'deal_id' => 'nullable|exists:crm_deals,id',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $proposal = CrmInteractiveProposal::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
        ]);

        return response()->json($proposal, 201);
    }

    public function viewInteractiveProposal(string $token): JsonResponse
    {
        $proposal = CrmInteractiveProposal::where('token', $token)
            ->with(['quote.items', 'deal:id,title'])
            ->firstOrFail();

        if ($proposal->isExpired()) {
            return response()->json(['message' => 'Proposta expirada'], 410);
        }

        $proposal->recordView();

        CrmTrackingEvent::create([
            'tenant_id' => $proposal->tenant_id,
            'trackable_type' => CrmInteractiveProposal::class,
            'trackable_id' => $proposal->id,
            'event_type' => 'proposal_viewed',
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return response()->json($proposal);
    }

    public function respondToProposal(Request $request, string $token): JsonResponse
    {
        $proposal = CrmInteractiveProposal::where('token', $token)->firstOrFail();

        if ($proposal->isExpired()) {
            return response()->json(['message' => 'Proposta expirada'], 410);
        }

        $data = $request->validate([
            'action' => ['required', Rule::in(['accept', 'reject'])],
            'client_notes' => 'nullable|string',
            'client_signature' => 'nullable|string',
            'item_interactions' => 'nullable|array',
        ]);

        $proposal->update([
            'status' => $data['action'] === 'accept' ? 'accepted' : 'rejected',
            'client_notes' => $data['client_notes'] ?? null,
            'client_signature' => $data['client_signature'] ?? null,
            'item_interactions' => $data['item_interactions'] ?? null,
            $data['action'] === 'accept' ? 'accepted_at' : 'rejected_at' => now(),
        ]);

        // If accepted, update quote status
        if ($data['action'] === 'accept' && $proposal->quote_id) {
            Quote::where('id', $proposal->quote_id)->update(['status' => 'approved']);
        }

        return response()->json(['message' => $data['action'] === 'accept' ? 'Proposta aceita!' : 'Proposta recusada']);
    }

    // ═══════════════════════════════════════════════════════
    // 13. TRACKING (Email/Proposal opens)
    // ═══════════════════════════════════════════════════════

    public function trackingEvents(Request $request): JsonResponse
    {
        $events = CrmTrackingEvent::where('tenant_id', $this->tenantId($request))
            ->with(['customer:id,name', 'deal:id,title'])
            ->when($request->input('event_type'), fn($q, $t) => $q->byType($t))
            ->when($request->input('deal_id'), fn($q, $id) => $q->where('deal_id', $id))
            ->when($request->input('customer_id'), fn($q, $id) => $q->where('customer_id', $id))
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 30));

        return response()->json($events);
    }

    public function trackingPixel(string $trackingId): mixed
    {
        $parts = explode('-', $trackingId);
        if (count($parts) >= 3) {
            $tenantId = $parts[0];
            $type = $parts[1];
            $entityId = $parts[2];

            try {
                CrmTrackingEvent::create([
                    'tenant_id' => $tenantId,
                    'trackable_type' => $type === 'msg' ? 'App\\Models\\CrmMessage' : 'App\\Models\\CrmInteractiveProposal',
                    'trackable_id' => $entityId,
                    'event_type' => 'email_opened',
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                ]);
            } catch (\Throwable $e) {
                Log::warning('Tracking pixel error', ['error' => $e->getMessage()]);
            }
        }

        // Return 1x1 transparent GIF
        return response(base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'))
            ->header('Content-Type', 'image/gif')
            ->header('Cache-Control', 'no-store, no-cache');
    }

    // ═══════════════════════════════════════════════════════
    // 14. NPS AUTOMATION
    // ═══════════════════════════════════════════════════════

    public function npsAutomationConfig(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $stats = DB::table('nps_responses')
            ->where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subMonths(3))
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN score >= 9 THEN 1 ELSE 0 END) as promoters,
                SUM(CASE WHEN score BETWEEN 7 AND 8 THEN 1 ELSE 0 END) as passives,
                SUM(CASE WHEN score <= 6 THEN 1 ELSE 0 END) as detractors
            ")
            ->first();

        $npsScore = 0;
        if ($stats && $stats->total > 0) {
            $npsScore = round((($stats->promoters - $stats->detractors) / $stats->total) * 100);
        }

        return response()->json([
            'nps_score' => $npsScore,
            'total_responses' => $stats->total ?? 0,
            'promoters' => $stats->promoters ?? 0,
            'passives' => $stats->passives ?? 0,
            'detractors' => $stats->detractors ?? 0,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 15. REFERRAL PROGRAM
    // ═══════════════════════════════════════════════════════

    public function referrals(Request $request): JsonResponse
    {
        $referrals = CrmReferral::where('tenant_id', $this->tenantId($request))
            ->with(['referrer:id,name', 'referred:id,name', 'deal:id,title,status,value'])
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 20));

        return response()->json($referrals);
    }

    public function storeReferral(Request $request): JsonResponse
    {
        $data = $request->validate([
            'referrer_customer_id' => 'required|exists:customers,id',
            'referred_name' => 'required|string|max:255',
            'referred_email' => 'nullable|email',
            'referred_phone' => 'nullable|string',
            'reward_type' => [Rule::in(array_keys(CrmReferral::REWARD_TYPES))],
            'reward_value' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $referral = CrmReferral::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
        ]);

        return response()->json($referral, 201);
    }

    public function updateReferral(Request $request, CrmReferral $referral): JsonResponse
    {
        $data = $request->validate([
            'status' => [Rule::in(array_keys(CrmReferral::STATUSES))],
            'referred_customer_id' => 'nullable|exists:customers,id',
            'deal_id' => 'nullable|exists:crm_deals,id',
            'reward_given' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        $referral->update($data);

        if (($data['status'] ?? null) === 'converted') {
            $referral->update(['converted_at' => now()]);
        }
        if ($data['reward_given'] ?? false) {
            $referral->update(['reward_given_at' => now()]);
        }

        return response()->json($referral);
    }

    public function referralStats(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $stats = [
            'total' => CrmReferral::where('tenant_id', $tenantId)->count(),
            'pending' => CrmReferral::where('tenant_id', $tenantId)->where('status', 'pending')->count(),
            'converted' => CrmReferral::where('tenant_id', $tenantId)->where('status', 'converted')->count(),
            'conversion_rate' => 0,
            'total_reward_value' => CrmReferral::where('tenant_id', $tenantId)
                ->where('reward_given', true)->sum('reward_value'),
            'top_referrers' => CrmReferral::where('tenant_id', $tenantId)
                ->select('referrer_customer_id', DB::raw('COUNT(*) as count'),
                    DB::raw('SUM(CASE WHEN status = "converted" THEN 1 ELSE 0 END) as converted_count'))
                ->groupBy('referrer_customer_id')
                ->with('referrer:id,name')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
        ];

        if ($stats['total'] > 0) {
            $stats['conversion_rate'] = round(($stats['converted'] / $stats['total']) * 100, 1);
        }

        return response()->json($stats);
    }

    // ═══════════════════════════════════════════════════════
    // 16. COMMERCIAL CALENDAR
    // ═══════════════════════════════════════════════════════

    public function calendarEvents(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $start = $request->input('start', now()->startOfMonth()->toDateString());
        $end = $request->input('end', now()->endOfMonth()->toDateString());

        $events = CrmCalendarEvent::where('tenant_id', $tenantId)
            ->with(['customer:id,name', 'deal:id,title', 'user:id,name'])
            ->between($start, $end)
            ->when($request->input('user_id'), fn($q, $uid) => $q->byUser($uid))
            ->orderBy('start_at')
            ->get();

        // Merge with CRM activities
        $activities = CrmActivity::where('tenant_id', $tenantId)
            ->whereNotNull('scheduled_at')
            ->whereBetween('scheduled_at', [$start, $end])
            ->with(['customer:id,name', 'deal:id,title', 'user:id,name'])
            ->get()
            ->map(fn($a) => [
                'id' => 'activity-' . $a->id,
                'title' => $a->title,
                'start_at' => $a->scheduled_at,
                'end_at' => $a->scheduled_at->addMinutes($a->duration_minutes ?? 30),
                'type' => $a->type,
                'customer' => $a->customer,
                'deal' => $a->deal,
                'user' => $a->user,
                'is_activity' => true,
                'completed' => $a->completed_at !== null,
            ]);

        // Merge with contract deadlines
        $renewals = CrmContractRenewal::where('tenant_id', $tenantId)
            ->whereBetween('contract_end_date', [$start, $end])
            ->with('customer:id,name')
            ->get()
            ->map(fn($r) => [
                'id' => 'renewal-' . $r->id,
                'title' => "Venc. Contrato: " . ($r->customer->name ?? ''),
                'start_at' => $r->contract_end_date,
                'end_at' => $r->contract_end_date,
                'type' => 'contract_renewal',
                'customer' => $r->customer,
                'all_day' => true,
                'is_renewal' => true,
            ]);

        return response()->json([
            'events' => $events,
            'activities' => $activities,
            'renewals' => $renewals,
        ]);
    }

    public function storeCalendarEvent(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => ['required', Rule::in(array_keys(CrmCalendarEvent::TYPES))],
            'start_at' => 'required|date',
            'end_at' => 'required|date|after_or_equal:start_at',
            'all_day' => 'boolean',
            'location' => 'nullable|string',
            'customer_id' => 'nullable|exists:customers,id',
            'deal_id' => 'nullable|exists:crm_deals,id',
            'color' => 'nullable|string',
            'reminders' => 'nullable|array',
        ]);

        $event = CrmCalendarEvent::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
            'user_id' => $request->user()->id,
        ]);

        return response()->json($event, 201);
    }

    public function updateCalendarEvent(Request $request, CrmCalendarEvent $event): JsonResponse
    {
        $event->update($request->validate([
            'title' => 'string|max:255',
            'description' => 'nullable|string',
            'type' => [Rule::in(array_keys(CrmCalendarEvent::TYPES))],
            'start_at' => 'date',
            'end_at' => 'date',
            'all_day' => 'boolean',
            'location' => 'nullable|string',
            'customer_id' => 'nullable|exists:customers,id',
            'deal_id' => 'nullable|exists:crm_deals,id',
            'color' => 'nullable|string',
        ]));

        return response()->json($event);
    }

    public function destroyCalendarEvent(CrmCalendarEvent $event): JsonResponse
    {
        try {
            $event->delete();
            return response()->json(['message' => 'Evento removido']);
        } catch (\Exception $e) {
            Log::error('CrmFeatures destroyCalendarEvent failed', ['event_id' => $event->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover evento'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════
    // 17. COHORT ANALYSIS
    // ═══════════════════════════════════════════════════════

    public function cohortAnalysis(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $months = $request->input('months', 12);

        $cohorts = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $cohortStart = now()->subMonths($i)->startOfMonth();
            $cohortEnd = now()->subMonths($i)->endOfMonth();
            $label = $cohortStart->format('Y-m');

            $created = CrmDeal::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$cohortStart, $cohortEnd])
                ->count();

            $conversions = [];
            for ($j = 0; $j <= min($i, 6); $j++) {
                $checkDate = $cohortStart->copy()->addMonths($j)->endOfMonth();
                $won = CrmDeal::where('tenant_id', $tenantId)
                    ->whereBetween('created_at', [$cohortStart, $cohortEnd])
                    ->won()
                    ->where('won_at', '<=', $checkDate)
                    ->count();

                $conversions["month_{$j}"] = $created > 0 ? round(($won / $created) * 100, 1) : 0;
            }

            $cohorts[] = [
                'cohort' => $label,
                'created' => $created,
                'conversions' => $conversions,
            ];
        }

        return response()->json($cohorts);
    }

    // ═══════════════════════════════════════════════════════
    // 18. REVENUE INTELLIGENCE DASHBOARD
    // ═══════════════════════════════════════════════════════

    public function revenueIntelligence(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        // MRR from active contracts
        $contractCustomers = Customer::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereNotNull('contract_type')
            ->where('contract_type', '!=', 'avulso')
            ->count();

        $mrr = CrmDeal::where('tenant_id', $tenantId)
            ->won()
            ->whereHas('customer', fn($q) => $q->whereNotNull('contract_type')->where('contract_type', '!=', 'avulso'))
            ->where('won_at', '>=', now()->subYear())
            ->avg('value') ?? 0;

        // One-time revenue
        $oneTimeRevenue = CrmDeal::where('tenant_id', $tenantId)
            ->won()
            ->where('won_at', '>=', now()->startOfMonth())
            ->whereHas('customer', fn($q) => $q->where(function ($q2) {
                $q2->whereNull('contract_type')->orWhere('contract_type', 'avulso');
            }))
            ->sum('value');

        // Churn rate
        $totalActiveStart = Customer::where('tenant_id', $tenantId)
            ->where('created_at', '<=', now()->subMonth()->startOfMonth())
            ->where('is_active', true)
            ->count();

        $churned = Customer::where('tenant_id', $tenantId)
            ->where('is_active', false)
            ->where('updated_at', '>=', now()->subMonth()->startOfMonth())
            ->count();

        $churnRate = $totalActiveStart > 0 ? round(($churned / $totalActiveStart) * 100, 1) : 0;

        // LTV
        $avgDealValue = CrmDeal::where('tenant_id', $tenantId)->won()->avg('value') ?? 0;
        $avgDealsPerCustomer = CrmDeal::where('tenant_id', $tenantId)->won()
            ->select('customer_id', DB::raw('COUNT(*) as cnt'))
            ->groupBy('customer_id')
            ->get()
            ->avg('cnt') ?? 1;

        $ltv = $avgDealValue * $avgDealsPerCustomer;

        // Monthly revenue trend
        $monthlyRevenue = CrmDeal::where('tenant_id', $tenantId)
            ->won()
            ->where('won_at', '>=', now()->subMonths(12))
            ->selectRaw('DATE_FORMAT(won_at, "%Y-%m") as month, SUM(value) as revenue, COUNT(*) as deals')
            ->groupByRaw('DATE_FORMAT(won_at, "%Y-%m")')
            ->orderBy('month')
            ->get();

        // By segment
        $bySegment = CrmDeal::where('crm_deals.tenant_id', $tenantId)
            ->where('crm_deals.status', 'won')
            ->whereNotNull('crm_deals.won_at')
            ->where('crm_deals.won_at', '>=', now()->subYear())
            ->whereNull('crm_deals.deleted_at')
            ->join('customers', 'crm_deals.customer_id', '=', 'customers.id')
            ->select('customers.segment', DB::raw('SUM(crm_deals.value) as revenue'), DB::raw('COUNT(*) as deals'))
            ->groupBy('customers.segment')
            ->orderByDesc('revenue')
            ->get();

        return response()->json([
            'mrr' => round($mrr, 2),
            'contract_customers' => $contractCustomers,
            'one_time_revenue' => round($oneTimeRevenue, 2),
            'churn_rate' => $churnRate,
            'ltv' => round($ltv, 2),
            'avg_deal_value' => round($avgDealValue, 2),
            'monthly_revenue' => $monthlyRevenue,
            'by_segment' => $bySegment,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 19. COMPETITIVE MATRIX
    // ═══════════════════════════════════════════════════════

    public function competitiveMatrix(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $months = $request->input('months', 12);
        $since = now()->subMonths($months);

        $competitors = CrmDealCompetitor::join('crm_deals', 'crm_deal_competitors.deal_id', '=', 'crm_deals.id')
            ->where('crm_deals.tenant_id', $tenantId)
            ->where('crm_deals.created_at', '>=', $since)
            ->whereNull('crm_deals.deleted_at')
            ->select(
                'crm_deal_competitors.competitor_name',
                DB::raw('COUNT(*) as total_encounters'),
                DB::raw('SUM(CASE WHEN crm_deals.status = "won" THEN 1 ELSE 0 END) as wins'),
                DB::raw('SUM(CASE WHEN crm_deals.status = "lost" THEN 1 ELSE 0 END) as losses'),
                DB::raw('AVG(crm_deal_competitors.competitor_price) as avg_price'),
                DB::raw('AVG(crm_deals.value) as our_avg_price'),
            )
            ->groupBy('crm_deal_competitors.competitor_name')
            ->orderByDesc('total_encounters')
            ->get()
            ->map(function ($c) {
                $total = $c->wins + $c->losses;
                $c->win_rate = $total > 0 ? round(($c->wins / $total) * 100, 1) : 0;
                $c->price_diff = $c->avg_price && $c->our_avg_price
                    ? round((($c->our_avg_price - $c->avg_price) / $c->avg_price) * 100, 1)
                    : null;
                return $c;
            });

        return response()->json($competitors);
    }

    public function storeDealCompetitor(Request $request): JsonResponse
    {
        $data = $request->validate([
            'deal_id' => 'required|exists:crm_deals,id',
            'competitor_name' => 'required|string|max:255',
            'competitor_price' => 'nullable|numeric|min:0',
            'strengths' => 'nullable|string',
            'weaknesses' => 'nullable|string',
        ]);

        $competitor = CrmDealCompetitor::create($data);
        return response()->json($competitor, 201);
    }

    public function updateDealCompetitor(Request $request, CrmDealCompetitor $competitor): JsonResponse
    {
        $competitor->update($request->validate([
            'competitor_name' => 'string|max:255',
            'competitor_price' => 'nullable|numeric|min:0',
            'strengths' => 'nullable|string',
            'weaknesses' => 'nullable|string',
            'outcome' => [Rule::in(array_keys(CrmDealCompetitor::OUTCOMES))],
        ]));

        return response()->json($competitor);
    }

    // ═══════════════════════════════════════════════════════
    // 20. CONSTANTS (for frontend)
    // ═══════════════════════════════════════════════════════

    public function featuresConstants(): JsonResponse
    {
        return response()->json([
            'scoring_categories' => CrmLeadScoringRule::CATEGORIES,
            'scoring_operators' => CrmLeadScoringRule::OPERATORS,
            'lead_grades' => CrmLeadScore::GRADES,
            'sequence_statuses' => CrmSequence::STATUSES,
            'sequence_action_types' => CrmSequenceStep::ACTION_TYPES,
            'enrollment_statuses' => CrmSequenceEnrollment::STATUSES,
            'alert_types' => CrmSmartAlert::TYPES,
            'alert_priorities' => CrmSmartAlert::PRIORITIES,
            'loss_reason_categories' => CrmLossReason::CATEGORIES,
            'competitor_outcomes' => CrmDealCompetitor::OUTCOMES,
            'territory_roles' => CrmTerritoryMember::ROLES,
            'goal_period_types' => CrmSalesGoal::PERIOD_TYPES,
            'renewal_statuses' => CrmContractRenewal::STATUSES,
            'proposal_statuses' => CrmInteractiveProposal::STATUSES,
            'tracking_event_types' => CrmTrackingEvent::EVENT_TYPES,
            'referral_statuses' => CrmReferral::STATUSES,
            'referral_reward_types' => CrmReferral::REWARD_TYPES,
            'calendar_event_types' => CrmCalendarEvent::TYPES,
            'forecast_period_types' => CrmForecastSnapshot::PERIOD_TYPES,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 21. CSV EXPORT / IMPORT (#15)
    // ═══════════════════════════════════════════════════════

    public function exportDealsCsv(Request $request): mixed
    {
        $tenantId = $this->tenantId($request);

        $query = CrmDeal::where('tenant_id', $tenantId)
            ->with(['customer:id,name', 'pipeline:id,name', 'stage:id,name', 'assignee:id,name']);

        if ($request->input('pipeline_id')) {
            $query->where('pipeline_id', (int) $request->input('pipeline_id'));
        }
        if ($request->input('status')) {
            $query->where('status', $request->input('status'));
        }

        $deals = $query->orderByDesc('created_at')->get();

        $headers = ['ID', 'Título', 'Cliente', 'Pipeline', 'Etapa', 'Valor', 'Probabilidade', 'Status', 'Origem', 'Responsável', 'Previsão Fechamento', 'Criado em'];

        $callback = function () use ($deals, $headers) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF)); // UTF-8 BOM
            fputcsv($file, $headers, ';');

            foreach ($deals as $deal) {
                fputcsv($file, [
                    $deal->id,
                    $deal->title,
                    $deal->customer?->name ?? '',
                    $deal->pipeline?->name ?? '',
                    $deal->stage?->name ?? '',
                    number_format($deal->value ?? 0, 2, ',', '.'),
                    $deal->probability ?? 0,
                    $deal->status,
                    $deal->source ?? '',
                    $deal->assignee?->name ?? '',
                    $deal->expected_close_date?->format('d/m/Y') ?? '',
                    $deal->created_at->format('d/m/Y H:i'),
                ], ';');
            }

            fclose($file);
        };

        $filename = 'deals_export_' . now()->format('Y-m-d_His') . '.csv';

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    public function importDealsCsv(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120',
        ]);

        $tenantId = $this->tenantId($request);
        $file = $request->file('file');
        $imported = 0;
        $errors = [];

        $handle = fopen($file->getPathname(), 'r');
        $headerRow = fgetcsv($handle, 0, ';');

        if (!$headerRow) {
            return response()->json(['imported' => 0, 'errors' => ['Arquivo CSV vazio ou malformado']], 422);
        }

        $headerMap = array_flip(array_map('mb_strtolower', array_map('trim', $headerRow)));
        $row = 1;

        $defaultPipeline = CrmPipeline::where('tenant_id', $tenantId)->default()->first();
        $firstStage = $defaultPipeline?->stages()->orderBy('sort_order')->first();

        while (($data = fgetcsv($handle, 0, ';')) !== false) {
            $row++;
            try {
                $title = trim($data[$headerMap['título'] ?? $headerMap['titulo'] ?? $headerMap['title'] ?? 0] ?? '');
                if (!$title) {
                    $errors[] = "Linha {$row}: título obrigatório";
                    continue;
                }

                $customerName = trim($data[$headerMap['cliente'] ?? $headerMap['customer'] ?? 99] ?? '');
                $customer = null;
                if ($customerName) {
                    $customer = Customer::where('tenant_id', $tenantId)
                        ->where('name', 'LIKE', "%{$customerName}%")
                        ->first();
                }

                if (!$customer) {
                    $errors[] = "Linha {$row}: cliente '{$customerName}' não encontrado";
                    continue;
                }

                $valueStr = trim($data[$headerMap['valor'] ?? $headerMap['value'] ?? 99] ?? '0');
                $value = (float) str_replace(['.', ','], ['', '.'], $valueStr);

                CrmDeal::create([
                    'tenant_id' => $tenantId,
                    'title' => $title,
                    'customer_id' => $customer->id,
                    'pipeline_id' => $defaultPipeline?->id,
                    'stage_id' => $firstStage?->id,
                    'value' => $value,
                    'source' => trim($data[$headerMap['origem'] ?? $headerMap['source'] ?? 99] ?? '') ?: null,
                    'assigned_to' => $request->user()->id,
                ]);

                $imported++;
            } catch (\Throwable $e) {
                $errors[] = "Linha {$row}: " . $e->getMessage();
            }
        }

        fclose($handle);

        return response()->json([
            'imported' => $imported,
            'errors' => array_slice($errors, 0, 20),
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // 22. CALENDAR ACTIVITIES INTEGRATION (#14)
    // ═══════════════════════════════════════════════════════

    public function calendarActivities(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $start = $request->input('start', now()->startOfMonth()->toDateString());
        $end = $request->input('end', now()->endOfMonth()->toDateString());

        $activities = CrmActivity::where('tenant_id', $tenantId)
            ->whereNotNull('scheduled_at')
            ->whereBetween('scheduled_at', [$start, $end])
            ->with(['customer:id,name', 'deal:id,title', 'user:id,name'])
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn($a) => [
                'id' => 'activity-' . $a->id,
                'title' => $a->title,
                'start_at' => $a->scheduled_at,
                'end_at' => $a->scheduled_at->addMinutes($a->duration_minutes ?? 30),
                'type' => $a->type,
                'customer' => $a->customer,
                'deal' => $a->deal,
                'user' => $a->user,
                'is_activity' => true,
                'completed' => $a->completed_at !== null,
                'notes' => $a->notes,
            ]);

        return response()->json($activities);
    }
}

