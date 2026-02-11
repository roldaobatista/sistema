<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionEvent;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
        if ($status = $request->get('status')) {
            $query->where('commission_goals.status', $status);
        }

        $goals = $query->orderByDesc('commission_goals.period')->get()->map(function ($goal) {
            $goal->bonus_rules = json_decode($goal->bonus_rules, true);
            $goal->achievement_pct = $goal->target_amount > 0
                ? round(($goal->achieved_amount / $goal->target_amount) * 100, 1)
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
            'bonus_rules' => 'nullable|array',
            'bonus_rules.*.threshold_pct' => 'required|numeric|min:1',
            'bonus_rules.*.bonus_pct' => 'required|numeric|min:0.01',
        ]);

        // Check uniqueness
        $existing = DB::table('commission_goals')
            ->where('tenant_id', $tenantId)
            ->where('user_id', $validated['user_id'])
            ->where('period', $validated['period'])
            ->exists();

        if ($existing) {
            return $this->error('Já existe uma meta para este usuário e período', 422);
        }

        $id = DB::transaction(function () use ($tenantId, $validated) {
            return DB::table('commission_goals')->insertGetId([
                'tenant_id' => $tenantId,
                'user_id' => $validated['user_id'],
                'period' => $validated['period'],
                'target_amount' => $validated['target_amount'],
                'bonus_rules' => json_encode($validated['bonus_rules'] ?? []),
                'achieved_amount' => 0,
                'status' => self::STATUS_ACTIVE,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return $this->success(['id' => $id], 'Meta criada', 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'target_amount' => 'sometimes|numeric|min:1',
            'bonus_rules' => 'sometimes|array',
            'status' => 'sometimes|in:' . self::STATUS_ACTIVE . ',' . self::STATUS_CLOSED,
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
        if (isset($validated['bonus_rules'])) $updates['bonus_rules'] = json_encode($validated['bonus_rules']);
        if (isset($validated['status'])) $updates['status'] = $validated['status'];

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

        $pct = $goal->target_amount > 0 ? round(($achieved / $goal->target_amount) * 100, 1) : 0;

        return $this->success([
            'achieved_amount' => (float) $achieved,
            'target_amount' => (float) $goal->target_amount,
            'achievement_pct' => $pct,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = DB::table('commission_goals')
            ->where('id', $id)
            ->where('tenant_id', $this->tenantId())
            ->delete();

        if (!$deleted) {
            return $this->error('Meta não encontrada', 404);
        }

        return response()->json(null, 204);
    }
}
