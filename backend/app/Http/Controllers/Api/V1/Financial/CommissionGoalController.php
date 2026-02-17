<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionEvent;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class CommissionGoalController extends Controller
{
    use ApiResponseTrait;

    private const STATUS_ACTIVE = 'active';
    private const STATUS_CLOSED = 'closed';

    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = DB::table('commission_goals')
            ->where('commission_goals.tenant_id', $this->tenantId())
            ->join('users', 'commission_goals.user_id', '=', 'users.id')
            ->select('commission_goals.*', 'users.name as user_name');

        if ($userId = $request->get('user_id')) {
            $query->where('commission_goals.user_id', $userId);
        }
        if ($period = $request->get('period')) {
            $query->where('commission_goals.period', $period);
        }
        if ($type = $request->get('type')) {
            $query->where('commission_goals.type', $type);
        }

        $goals = $query->orderByDesc('commission_goals.period')->get()->map(function ($goal) {
            $goal->achievement_pct = bccomp((string) $goal->target_amount, '0', 2) > 0
                ? (float) bcmul(bcdiv((string) $goal->achieved_amount, (string) $goal->target_amount, 4), '100', 1)
                : 0;
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

        $existing = DB::table('commission_goals')
            ->where('tenant_id', $tenantId)
            ->where('user_id', $validated['user_id'])
            ->where('period', $validated['period'])
            ->where('type', $goalType)
            ->exists();

        if ($existing) {
            return $this->error('Já existe uma meta deste tipo para este usuário e período', 422);
        }

        try {
            $id = DB::transaction(function () use ($tenantId, $validated) {
                return DB::table('commission_goals')->insertGetId([
                    'tenant_id' => $tenantId,
                    'user_id' => $validated['user_id'],
                    'period' => $validated['period'],
                    'target_amount' => $validated['target_amount'],
                    'type' => $validated['type'] ?? 'revenue',
                    'bonus_percentage' => $validated['bonus_percentage'] ?? null,
                    'bonus_amount' => $validated['bonus_amount'] ?? null,
                    'notes' => $validated['notes'] ?? null,
                    'achieved_amount' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            return $this->success(['id' => $id], 'Meta criada', 201);
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

        $exists = DB::table('commission_goals')
            ->where('id', $id)
            ->where('tenant_id', $this->tenantId())
            ->exists();

        if (!$exists) {
            return $this->error('Meta não encontrada', 404);
        }

        $updates = ['updated_at' => now()];
        if (isset($validated['target_amount'])) $updates['target_amount'] = $validated['target_amount'];
        if (isset($validated['type'])) $updates['type'] = $validated['type'];
        if (array_key_exists('bonus_percentage', $validated)) $updates['bonus_percentage'] = $validated['bonus_percentage'];
        if (array_key_exists('bonus_amount', $validated)) $updates['bonus_amount'] = $validated['bonus_amount'];
        if (array_key_exists('notes', $validated)) $updates['notes'] = $validated['notes'];

        DB::transaction(function () use ($id, $updates) {
            DB::table('commission_goals')
                ->where('id', $id)
                ->where('tenant_id', $this->tenantId())
                ->update($updates);
        });

        return $this->success(null, 'Meta atualizada');
    }

    /** Recalculate achieved amount based on commission events */
    public function refreshAchievement(int $id): JsonResponse
    {
        $tid = $this->tenantId();
        $goal = DB::table('commission_goals')->where('id', $id)->where('tenant_id', $tid)->first();
        if (!$goal) return $this->error('Meta não encontrada', 404);

        try {
            $driver = DB::getDriverName();
            $periodFilter = $driver === 'sqlite'
                ? "strftime('%Y-%m', created_at) = ?"
                : "DATE_FORMAT(created_at, '%Y-%m') = ?";

            $achieved = DB::table('commission_events')
                ->where('tenant_id', $tid)
                ->where('user_id', $goal->user_id)
                ->whereIn('status', [CommissionEvent::STATUS_APPROVED, CommissionEvent::STATUS_PAID])
                ->whereRaw($periodFilter, [$goal->period])
                ->sum('commission_amount');

            DB::table('commission_goals')->where('id', $id)->update([
                'achieved_amount' => $achieved,
                'updated_at' => now(),
            ]);

            $pct = bccomp((string) $goal->target_amount, '0', 2) > 0
                ? (float) bcmul(bcdiv((string) $achieved, (string) $goal->target_amount, 4), '100', 1)
                : 0;

            return $this->success([
                'achieved_amount' => (float) $achieved,
                'target_amount' => (float) $goal->target_amount,
                'achievement_pct' => $pct,
            ]);
        } catch (\Exception $e) {
            Log::error('Falha ao recalcular meta de comissão', ['error' => $e->getMessage(), 'goal_id' => $id]);
            return $this->error('Erro ao recalcular meta', 500);
        }
    }

    public function destroy(int $id): JsonResponse
    {
        try {
            $deleted = DB::table('commission_goals')
                ->where('id', $id)
                ->where('tenant_id', $this->tenantId())
                ->delete();

            if (!$deleted) {
                return $this->error('Meta não encontrada', 404);
            }

            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Falha ao excluir meta de comissão', ['error' => $e->getMessage(), 'goal_id' => $id]);
            return $this->error('Erro interno ao excluir meta', 500);
        }
    }
}
