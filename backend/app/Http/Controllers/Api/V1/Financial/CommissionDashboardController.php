<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionEvent;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommissionDashboardController extends Controller
{
    use ApiResponseTrait;

    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    /** KPIs: total pendente, aprovado, pago mensal, variação % */
    public function overview(): JsonResponse
    {
        $tid = $this->tenantId();
        $now = now();
        $lastMonth = $now->copy()->subMonth();

        $pending = CommissionEvent::where('tenant_id', $tid)->where('status', CommissionEvent::STATUS_PENDING)->sum('commission_amount');
        $approved = CommissionEvent::where('tenant_id', $tid)->where('status', CommissionEvent::STATUS_APPROVED)->sum('commission_amount');

        $paidThisMonth = CommissionEvent::where('tenant_id', $tid)->where('status', CommissionEvent::STATUS_PAID)
            ->whereMonth('updated_at', $now->month)->whereYear('updated_at', $now->year)
            ->sum('commission_amount');
        $paidLastMonth = CommissionEvent::where('tenant_id', $tid)->where('status', CommissionEvent::STATUS_PAID)
            ->whereMonth('updated_at', $lastMonth->month)->whereYear('updated_at', $lastMonth->year)
            ->sum('commission_amount');

        $variation = $paidLastMonth > 0
            ? round((($paidThisMonth - $paidLastMonth) / $paidLastMonth) * 100, 1)
            : ($paidThisMonth > 0 ? 100 : 0);

        $totalEvents = CommissionEvent::where('tenant_id', $tid)->count();
        $totalRules = \App\Models\CommissionRule::where('tenant_id', $tid)->where('active', true)->count();

        return $this->success([
            'pending' => (float) $pending,
            'approved' => (float) $approved,
            'paid_this_month' => (float) $paidThisMonth,
            'paid_last_month' => (float) $paidLastMonth,
            'variation_pct' => $variation,
            'total_events' => $totalEvents,
            'total_rules' => $totalRules,
        ]);
    }

    /** Top 10 beneficiários por valor em um período */
    public function ranking(Request $request): JsonResponse
    {
        $tid = $this->tenantId();
        $period = $request->get('period', now()->format('Y-m'));

        $driver = DB::getDriverName();
        $periodFilter = $driver === 'sqlite'
            ? "strftime('%Y-%m', commission_events.created_at) = ?"
            : "DATE_FORMAT(commission_events.created_at, '%Y-%m') = ?";

        $ranking = DB::table('commission_events')
            ->join('users', 'commission_events.user_id', '=', 'users.id')
            ->where('commission_events.tenant_id', $tid)
            ->whereIn('commission_events.status', [CommissionEvent::STATUS_APPROVED, CommissionEvent::STATUS_PAID])
            ->whereRaw($periodFilter, [$period])
            ->selectRaw('users.id, users.name, SUM(commission_events.commission_amount) as total, COUNT(*) as events_count')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('total')
            ->limit(10)
            ->get()
            ->map(function ($row, $index) {
                $row->position = $index + 1;
                $row->medal = match ($index) {
                    0 => '🥇', 1 => '🥈', 2 => '🥉', default => null,
                };
                return $row;
            });

        return $this->success($ranking);
    }

    /** Série temporal mensal (últimos N meses) */
    public function evolution(Request $request): JsonResponse
    {
        $tid = $this->tenantId();
        $months = min((int) $request->get('months', 6), 12);
        $data = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $date = now()->subMonths($i);
            $period = $date->format('Y-m');

            $total = CommissionEvent::where('tenant_id', $tid)
                ->whereIn('status', [CommissionEvent::STATUS_APPROVED, CommissionEvent::STATUS_PAID])
                ->whereMonth('created_at', $date->month)
                ->whereYear('created_at', $date->year)
                ->sum('commission_amount');

            $data[] = [
                'period' => $period,
                'label' => $date->translatedFormat('M/Y'),
                'total' => (float) $total,
            ];
        }

        return $this->success($data);
    }

    /** Distribuição por tipo de cálculo */
    public function byRule(Request $request): JsonResponse
    {
        $tid = $this->tenantId();

        $distribution = DB::table('commission_events')
            ->join('commission_rules', 'commission_events.commission_rule_id', '=', 'commission_rules.id')
            ->where('commission_events.tenant_id', $tid)
            ->selectRaw('commission_rules.calculation_type, SUM(commission_events.commission_amount) as total, COUNT(*) as count')
            ->groupBy('commission_rules.calculation_type')
            ->orderByDesc('total')
            ->get();

        return $this->success($distribution);
    }

    /** Distribuição por papel (técnico/vendedor/motorista) */
    public function byRole(Request $request): JsonResponse
    {
        $tid = $this->tenantId();

        $distribution = DB::table('commission_events')
            ->join('commission_rules', 'commission_events.commission_rule_id', '=', 'commission_rules.id')
            ->where('commission_events.tenant_id', $tid)
            ->selectRaw('commission_rules.applies_to_role as role, SUM(commission_events.commission_amount) as total, COUNT(*) as count')
            ->groupBy('commission_rules.applies_to_role')
            ->orderByDesc('total')
            ->get();

        return $this->success($distribution);
    }
}
