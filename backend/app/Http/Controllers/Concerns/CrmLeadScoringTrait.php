<?php

namespace App\Http\Controllers\Concerns;

use App\Models\CrmLeadScore;
use App\Models\CrmLeadScoringRule;
use App\Models\CrmSequence;
use App\Models\CrmSequenceEnrollment;
use App\Models\CrmSequenceStep;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Lead Scoring & Sequences domain (T4 split).
 *
 * Extracted from CrmFeaturesController to improve maintainability.
 */
trait CrmLeadScoringTrait
{
    // ═══════════════════════════════════════════════════════
    // 1. LEAD SCORING
    // ═══════════════════════════════════════════════════════

    abstract protected function tenantId(Request $request): int;

    public function scoringRules(Request $request): JsonResponse
    {
        $rules = CrmLeadScoringRule::where('tenant_id', $this->tenantId($request))
            ->orderBy('category')
            ->orderByDesc('points')
            ->get();

        return response()->json($rules);
    }

    public function storeScoringRule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category' => 'required|string',
            'field' => 'required|string',
            'operator' => 'required|string',
            'value' => 'required',
            'points' => 'required|integer|between:-100,100',
            'description' => 'nullable|string|max:500',
        ]);

        $data['tenant_id'] = $this->tenantId($request);

        $rule = CrmLeadScoringRule::create($data);

        return response()->json($rule, 201);
    }

    public function updateScoringRule(Request $request, CrmLeadScoringRule $rule): JsonResponse
    {
        $data = $request->validate([
            'category' => 'sometimes|string',
            'field' => 'sometimes|string',
            'operator' => 'sometimes|string',
            'value' => 'sometimes',
            'points' => 'sometimes|integer|between:-100,100',
            'description' => 'nullable|string|max:500',
        ]);

        $rule->update($data);

        return response()->json($rule);
    }

    public function destroyScoringRule(CrmLeadScoringRule $rule): JsonResponse
    {
        try {
            $rule->delete();
            return response()->json(['message' => 'Regra excluída com sucesso']);
        } catch (\Exception $e) {
            Log::error('CrmLeadScoring destroyScoringRule failed', ['rule_id' => $rule->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir regra'], 500);
        }
    }

    public function calculateScores(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $rules = CrmLeadScoringRule::where('tenant_id', $tenantId)->get();
        $customers = Customer::where('tenant_id', $tenantId)->get();
        $results = [];

        foreach ($customers as $customer) {
            $totalPoints = 0;
            foreach ($rules as $rule) {
                $value = match ($rule->category) {
                    'demographic' => $customer->{$rule->field} ?? null,
                    'behavioral' => $this->getCustomerBehavioralValue($customer, $rule->field),
                    'firmographic' => $customer->{$rule->field} ?? null,
                    default => null,
                };
                if ($this->evaluateScoringRule($rule, $value)) {
                    $totalPoints += $rule->points;
                }
            }

            $grade = match (true) {
                $totalPoints >= 80 => 'A',
                $totalPoints >= 60 => 'B',
                $totalPoints >= 40 => 'C',
                $totalPoints >= 20 => 'D',
                default => 'F',
            };

            $score = CrmLeadScore::updateOrCreate(
                ['tenant_id' => $tenantId, 'customer_id' => $customer->id],
                ['total_points' => $totalPoints, 'grade' => $grade, 'details' => [], 'calculated_at' => now()]
            );

            $results[] = $score;
        }

        return response()->json([
            'calculated' => count($results),
            'message' => 'Scores calculados com sucesso',
        ]);
    }

    public function leaderboard(Request $request): JsonResponse
    {
        $scores = CrmLeadScore::where('tenant_id', $this->tenantId($request))
            ->with('customer:id,name,email')
            ->orderByDesc('total_points')
            ->take(50)
            ->get();

        return response()->json($scores);
    }

    protected function evaluateScoringRule(CrmLeadScoringRule $rule, $value): bool
    {
        return match ($rule->operator) {
            'equals' => $value == $rule->value,
            'not_equals' => $value != $rule->value,
            'greater_than' => $value > $rule->value,
            'less_than' => $value < $rule->value,
            'contains' => is_string($value) && str_contains(strtolower($value), strtolower($rule->value)),
            'not_contains' => is_string($value) && !str_contains(strtolower($value), strtolower($rule->value)),
            'is_empty' => empty($value),
            'is_not_empty' => !empty($value),
            'between' => $this->evaluateBetween($value, $rule->value),
            default => false,
        };
    }

    protected function evaluateBetween($value, string $range): bool
    {
        $parts = explode(',', $range);
        if (count($parts) !== 2) return false;
        return $value >= (float) $parts[0] && $value <= (float) $parts[1];
    }

    protected function getCustomerBehavioralValue(Customer $customer, string $field)
    {
        return match ($field) {
            'deals_count' => $customer->deals()->count(),
            'total_revenue' => $customer->deals()->where('status', 'won')->sum('value'),
            'last_interaction_days' => $customer->activities()->latest()->value('created_at')
                ? now()->diffInDays($customer->activities()->latest()->value('created_at'))
                : 999,
            default => null,
        };
    }

    // ═══════════════════════════════════════════════════════
    // 2. SEQUENCES
    // ═══════════════════════════════════════════════════════

    public function sequences(Request $request): JsonResponse
    {
        $sequences = CrmSequence::where('tenant_id', $this->tenantId($request))
            ->withCount('enrollments')
            ->with('steps')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($sequences);
    }

    public function showSequence(CrmSequence $sequence): JsonResponse
    {
        $sequence->load(['steps', 'enrollments.customer:id,name']);
        return response()->json($sequence);
    }

    public function storeSequence(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'trigger_conditions' => 'nullable|array',
            'status' => 'in:draft,active,paused',
            'steps' => 'required|array|min:1',
            'steps.*.action_type' => 'required|string',
            'steps.*.config' => 'required|array',
            'steps.*.delay_days' => 'required|integer|min:0',
            'steps.*.sort_order' => 'required|integer',
        ]);

        $sequence = CrmSequence::create([
            'tenant_id' => $this->tenantId($request),
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'trigger_conditions' => $data['trigger_conditions'] ?? [],
            'status' => $data['status'] ?? 'draft',
        ]);

        foreach ($data['steps'] as $step) {
            CrmSequenceStep::create([
                'sequence_id' => $sequence->id,
                'action_type' => $step['action_type'],
                'config' => $step['config'],
                'delay_days' => $step['delay_days'],
                'sort_order' => $step['sort_order'],
            ]);
        }

        return response()->json($sequence->load('steps'), 201);
    }

    public function updateSequence(Request $request, CrmSequence $sequence): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'status' => 'in:draft,active,paused',
        ]);

        $sequence->update($data);
        return response()->json($sequence);
    }

    public function destroySequence(CrmSequence $sequence): JsonResponse
    {
        $sequence->steps()->delete();
        $sequence->enrollments()->delete();
        $sequence->delete();
        return response()->json(['message' => 'Sequência excluída']);
    }

    public function enrollInSequence(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sequence_id' => 'required|exists:crm_sequences,id',
            'customer_id' => 'required|exists:customers,id',
        ]);

        $existing = CrmSequenceEnrollment::where('sequence_id', $data['sequence_id'])
            ->where('customer_id', $data['customer_id'])
            ->whereIn('status', ['active', 'paused'])
            ->exists();

        if ($existing) {
            return response()->json(['message' => 'Cliente já está inscrito nesta sequência'], 422);
        }

        $firstStep = CrmSequenceStep::where('sequence_id', $data['sequence_id'])
            ->orderBy('sort_order')
            ->first();

        $enrollment = CrmSequenceEnrollment::create([
            'sequence_id' => $data['sequence_id'],
            'customer_id' => $data['customer_id'],
            'status' => 'active',
            'current_step_id' => $firstStep?->id,
            'next_action_at' => now()->addDays($firstStep?->delay_days ?? 0),
        ]);

        return response()->json($enrollment, 201);
    }

    public function unenrollFromSequence(CrmSequenceEnrollment $enrollment): JsonResponse
    {
        $enrollment->update(['status' => 'completed']);
        return response()->json(['message' => 'Desinscrito com sucesso']);
    }
}
