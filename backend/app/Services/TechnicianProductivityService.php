<?php

namespace App\Services;

use App\Models\WorkOrder;
use App\Models\User;
use App\Models\TimeEntry;
use App\Models\CommissionEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class TechnicianProductivityService
{
    /**
     * Get productivity metrics for a specific technician.
     */
    public function getMetrics(int $technicianId, int $tenantId, ?string $dateFrom = null, ?string $dateTo = null): array
    {
        $from = $dateFrom ? Carbon::parse($dateFrom) : Carbon::now()->startOfMonth();
        $to = $dateTo ? Carbon::parse($dateTo) : Carbon::now()->endOfMonth();

        $workOrders = WorkOrder::where('company_id', $tenantId)
            ->where('assigned_to', $technicianId)
            ->whereBetween('created_at', [$from, $to])
            ->get();

        $completed = $workOrders->whereIn('status', ['concluida', 'faturada']);
        $total = $workOrders->count();

        // Average execution time (in hours)
        $avgExecutionMinutes = $completed->avg(function ($wo) {
            if (!$wo->data_inicio || !$wo->data_conclusao) return 0;
            return Carbon::parse($wo->data_inicio)->diffInMinutes(Carbon::parse($wo->data_conclusao));
        }) ?? 0;

        // First-Time Fix Rate (OS completed without reopening)
        $reopened = $completed->filter(fn ($wo) => $wo->reopen_count > 0)->count();
        $firstFixRate = $completed->count() > 0
            ? round((($completed->count() - $reopened) / $completed->count()) * 100, 1)
            : 0;

        // SLA compliance
        $slaCompliant = $completed->filter(function ($wo) {
            if (!$wo->sla_deadline || !$wo->data_conclusao) return true;
            return Carbon::parse($wo->data_conclusao)->lte(Carbon::parse($wo->sla_deadline));
        })->count();
        $slaRate = $completed->count() > 0
            ? round(($slaCompliant / $completed->count()) * 100, 1)
            : 100;

        // NPS average
        $npsAvg = DB::table('nps_responses')
            ->where('company_id', $tenantId)
            ->where('technician_id', $technicianId)
            ->whereBetween('created_at', [$from, $to])
            ->avg('score');

        // Revenue generated
        $revenue = $completed->sum('valor_total') ?? 0;

        // Time entries (hours worked)
        $hoursWorked = TimeEntry::where('company_id', $tenantId)
            ->where('user_id', $technicianId)
            ->whereBetween('started_at', [$from, $to])
            ->sum(DB::raw("CAST(duration_minutes AS DECIMAL)")) / 60;

        // Commissions earned
        $commissions = CommissionEvent::where('company_id', $tenantId)
            ->where('beneficiary_id', $technicianId)
            ->whereBetween('created_at', [$from, $to])
            ->sum('value');

        return [
            'technician_id' => $technicianId,
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'os_total' => $total,
            'os_completed' => $completed->count(),
            'os_open' => $total - $completed->count(),
            'avg_execution_hours' => round($avgExecutionMinutes / 60, 1),
            'first_fix_rate' => $firstFixRate,
            'sla_compliance' => $slaRate,
            'nps_average' => $npsAvg ? round($npsAvg, 1) : null,
            'revenue_generated' => round($revenue, 2),
            'hours_worked' => round($hoursWorked, 1),
            'commissions_earned' => round($commissions, 2),
            'productivity_index' => $this->calculateIndex($completed->count(), $hoursWorked, $firstFixRate, $slaRate),
        ];
    }

    /**
     * Get ranking of technicians for a tenant.
     */
    public function getRanking(int $tenantId, ?string $dateFrom = null, ?string $dateTo = null, int $limit = 20): array
    {
        $from = $dateFrom ? Carbon::parse($dateFrom) : Carbon::now()->startOfMonth();
        $to = $dateTo ? Carbon::parse($dateTo) : Carbon::now()->endOfMonth();

        $technicians = User::where('company_id', $tenantId)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['tecnico', 'technician']))
            ->where('is_active', true)
            ->get();

        $ranking = $technicians->map(function ($tech) use ($tenantId, $from, $to) {
            $metrics = $this->getMetrics($tech->id, $tenantId, $from->toDateString(), $to->toDateString());
            return array_merge(['name' => $tech->name], $metrics);
        })
        ->sortByDesc('productivity_index')
        ->values()
        ->take($limit);

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'ranking' => $ranking->all(),
        ];
    }

    /**
     * Get team summary (aggregated metrics).
     */
    public function getTeamSummary(int $tenantId, ?string $dateFrom = null, ?string $dateTo = null): array
    {
        $from = $dateFrom ? Carbon::parse($dateFrom) : Carbon::now()->startOfMonth();
        $to = $dateTo ? Carbon::parse($dateTo) : Carbon::now()->endOfMonth();

        $completed = WorkOrder::where('company_id', $tenantId)
            ->whereIn('status', ['concluida', 'faturada'])
            ->whereBetween('created_at', [$from, $to])
            ->count();

        $avgTime = WorkOrder::where('company_id', $tenantId)
            ->whereIn('status', ['concluida', 'faturada'])
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('data_inicio')
            ->whereNotNull('data_conclusao')
            ->avg(DB::raw("CAST(julianday(data_conclusao) - julianday(data_inicio) AS REAL) * 24"));

        $nps = DB::table('nps_responses')
            ->where('company_id', $tenantId)
            ->whereBetween('created_at', [$from, $to])
            ->avg('score');

        $activeTechnicians = User::where('company_id', $tenantId)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['tecnico', 'technician']))
            ->where('is_active', true)
            ->count();

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'os_completed' => $completed,
            'avg_execution_hours' => $avgTime ? round($avgTime, 1) : 0,
            'nps_average' => $nps ? round($nps, 1) : null,
            'active_technicians' => $activeTechnicians,
            'os_per_technician' => $activeTechnicians > 0 ? round($completed / $activeTechnicians, 1) : 0,
        ];
    }

    /**
     * Calculate a composite productivity index (0-100).
     */
    private function calculateIndex(int $osCompleted, float $hoursWorked, float $firstFixRate, float $slaRate): float
    {
        $osPerHour = $hoursWorked > 0 ? ($osCompleted / $hoursWorked) : 0;
        $osScore = min(100, $osPerHour * 50); // Normalize: 2 OS/hour = 100
        $qualityScore = ($firstFixRate * 0.5) + ($slaRate * 0.5);

        return round(($osScore * 0.4) + ($qualityScore * 0.6), 1);
    }
}
