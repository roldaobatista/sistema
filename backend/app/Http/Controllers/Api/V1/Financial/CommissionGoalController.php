<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionEvent;
use App\Models\CommissionGoal;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class CommissionGoalController extends Controller
{
    use ApiResponseTrait;

    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = CommissionGoal::with('user:id,name')
            ->where('tenant_id', $this->tenantId());

        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($period = $request->get('period')) {
            $query->where('period', $period);
        }
        if ($type = $request->get('type')) {
            $query->where('type', $type);
        }

        $goals = $query->orderByDesc('period')->get()->map(function ($goal) {
            $goal->achievement_pct = $goal->progress_percentage;
            $goal->user_name = $goal->user?->name;
            return $goal;
        });

        return response()->json($goals);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        $validated = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'period' => ['required', 'string', 'size:7', 'regex:/^\d{4}-\d{2}$/'],
            'target_amount' => 'required|numeric|min:1',
            'type' => 'sometimes|in:revenue,os_count,new_clients',
            'bonus_percentage' => 'nullable|numeric|min:0|max:100',
            'bonus_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:1000',
        ]);

        $goalType = $validated['type'] ?? 'revenue';

        $existing = CommissionGoal::where('tenant_id', $tenantId)
            ->where('user_id', $validated['user_id'])
            ->where('period', $validated['period'])
            ->where('type', $goalType)
            ->exists();

        if ($existing) {
            return $this->error('Já existe uma meta deste tipo para este usuário e período', 422);
        }

        try {
            $goal = DB::transaction(function () use ($tenantId, $validated) {
                return CommissionGoal::create([
                    'tenant_id' => $tenantId,
                    'user_id' => $validated['user_id'],
                    'period' => $validated['period'],
                    'target_amount' => $validated['target_amount'],
                    'type' => $validated['type'] ?? 'revenue',
                    'bonus_percentage' => $validated['bonus_percentage'] ?? null,
                    'bonus_amount' => $validated['bonus_amount'] ?? null,
                    'notes' => $validated['notes'] ?? null,
                    'achieved_amount' => 0,
                ]);
            });

            return $this->success(['id' => $goal->id], 'Meta criada', 201);
        } catch (\Exception $e) {
            Log::error('Falha ao criar meta de comissão', ['error' => $e->getMessage()]);
            return $this->error('Erro interno ao criar meta', 500);
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'target_amount' => 'sometimes|numeric|min:1',
            'type' => 'sometimes|in:revenue,os_count,new_clients',
            'bonus_percentage' => 'nullable|numeric|min:0|max:100',
            'bonus_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:1000',
        ]);

        $goal = CommissionGoal::where('tenant_id', $this->tenantId())->find($id);

        if (!$goal) {
            return $this->error('Meta não encontrada', 404);
        }

        $updates = [];
        if (isset($validated['target_amount'])) $updates['target_amount'] = $validated['target_amount'];
        if (isset($validated['type'])) $updates['type'] = $validated['type'];
        if (array_key_exists('bonus_percentage', $validated)) $updates['bonus_percentage'] = $validated['bonus_percentage'];
        if (array_key_exists('bonus_amount', $validated)) $updates['bonus_amount'] = $validated['bonus_amount'];
        if (array_key_exists('notes', $validated)) $updates['notes'] = $validated['notes'];

        DB::transaction(fn () => $goal->update($updates));

        return $this->success(null, 'Meta atualizada');
    }

    /** Recalculate achieved amount based on commission events */
    public function refreshAchievement(int $id): JsonResponse
    {
        $tid = $this->tenantId();
        $goal = CommissionGoal::where('tenant_id', $tid)->find($id);
        if (!$goal) return $this->error('Meta não encontrada', 404);

        try {
            $driver = DB::getDriverName();
            $periodFilter = $driver === 'sqlite'
                ? "strftime('%Y-%m', created_at) = ?"
                : "DATE_FORMAT(created_at, '%Y-%m') = ?";

            $achieved = CommissionEvent::where('tenant_id', $tid)
                ->where('user_id', $goal->user_id)
                ->whereIn('status', [CommissionEvent::STATUS_APPROVED, CommissionEvent::STATUS_PAID])
                ->whereRaw($periodFilter, [$goal->period])
                ->sum('commission_amount');

            $goal->update(['achieved_amount' => $achieved]);

            return $this->success([
                'achieved_amount' => (float) $achieved,
                'target_amount' => (float) $goal->target_amount,
                'achievement_pct' => $goal->fresh()->progress_percentage,
            ]);
        } catch (\Exception $e) {
            Log::error('Falha ao recalcular meta de comissão', ['error' => $e->getMessage(), 'goal_id' => $id]);
            return $this->error('Erro ao recalcular meta', 500);
        }
    }

    public function destroy(int $id): JsonResponse
    {
        try {
            $goal = CommissionGoal::where('tenant_id', $this->tenantId())->find($id);

            if (!$goal) {
                return $this->error('Meta não encontrada', 404);
            }

            DB::transaction(fn () => $goal->delete());

            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Falha ao excluir meta de comissão', ['error' => $e->getMessage(), 'goal_id' => $id]);
            return $this->error('Erro interno ao excluir meta', 500);
        }
    }
}
