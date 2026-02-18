<?php

namespace App\Services;

use App\Models\WorkOrder;
use App\Models\ServiceCall;
use App\Models\SystemAlert;
use App\Models\User;
use App\Notifications\SlaEscalationNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class SlaEscalationService
{
    /**
     * SLA escalation thresholds (percentage of SLA deadline).
     * Each level triggers a different notification target.
     */
    private const ESCALATION_LEVELS = [
        ['threshold' => 50, 'level' => 'warning',  'target' => 'assigned'],
        ['threshold' => 75, 'level' => 'high',     'target' => 'supervisor'],
        ['threshold' => 90, 'level' => 'critical',  'target' => 'manager'],
        ['threshold' => 100, 'level' => 'breached', 'target' => 'director'],
    ];

    public function __construct(
        private WebPushService $webPush,
        private WhatsAppService $whatsApp,
    ) {}

    /**
     * Run SLA checks for all open work orders of a tenant.
     */
    public function runSlaChecks(int $tenantId): array
    {
        $results = ['checked' => 0, 'escalated' => 0, 'breached' => 0];

        $workOrders = WorkOrder::where('company_id', $tenantId)
            ->whereNotIn('status', ['concluida', 'cancelada', 'faturada'])
            ->whereNotNull('sla_deadline')
            ->get();

        foreach ($workOrders as $wo) {
            $results['checked']++;
            $escalation = $this->evaluateSla($wo);

            if ($escalation) {
                $this->escalate($wo, $escalation, $tenantId);
                $results['escalated']++;
                if ($escalation['level'] === 'breached') {
                    $results['breached']++;
                }
            }
        }

        // Also check service calls with SLA
        $serviceCalls = ServiceCall::where('company_id', $tenantId)
            ->whereNotIn('status', ['closed', 'cancelled', 'resolved'])
            ->whereNotNull('sla_deadline')
            ->get();

        foreach ($serviceCalls as $sc) {
            $results['checked']++;
            $escalation = $this->evaluateServiceCallSla($sc);
            if ($escalation) {
                $this->escalateServiceCall($sc, $escalation, $tenantId);
                $results['escalated']++;
            }
        }

        return $results;
    }

    /**
     * Evaluate SLA status for a work order.
     */
    public function evaluateSla(WorkOrder $wo): ?array
    {
        $deadline = Carbon::parse($wo->sla_deadline);
        $created = Carbon::parse($wo->created_at);
        $now = Carbon::now();

        $totalMinutes = $created->diffInMinutes($deadline);
        if ($totalMinutes <= 0) return null;

        $elapsedMinutes = $created->diffInMinutes($now);
        $percentUsed = ($elapsedMinutes / $totalMinutes) * 100;

        // Find the highest applicable escalation level not yet triggered
        $applicable = null;
        foreach (self::ESCALATION_LEVELS as $level) {
            if ($percentUsed >= $level['threshold']) {
                $key = "sla_escalation_{$level['level']}";
                if (!$this->alreadyEscalated($wo, $key)) {
                    $applicable = $level;
                }
            }
        }

        if (!$applicable) return null;

        return [
            'level' => $applicable['level'],
            'target' => $applicable['target'],
            'threshold' => $applicable['threshold'],
            'percent_used' => round($percentUsed, 1),
            'minutes_remaining' => max(0, $totalMinutes - $elapsedMinutes),
            'deadline' => $deadline->toIso8601String(),
        ];
    }

    /**
     * Evaluate SLA for a service call.
     */
    public function evaluateServiceCallSla(ServiceCall $sc): ?array
    {
        $deadline = Carbon::parse($sc->sla_deadline);
        $created = Carbon::parse($sc->created_at);
        $now = Carbon::now();

        $totalMinutes = $created->diffInMinutes($deadline);
        if ($totalMinutes <= 0) return null;

        $elapsedMinutes = $created->diffInMinutes($now);
        $percentUsed = ($elapsedMinutes / $totalMinutes) * 100;

        $applicable = null;
        foreach (self::ESCALATION_LEVELS as $level) {
            if ($percentUsed >= $level['threshold']) {
                $key = "sla_sc_escalation_{$level['level']}";
                if (!$this->alreadyEscalatedServiceCall($sc, $key)) {
                    $applicable = $level;
                }
            }
        }

        if (!$applicable) return null;

        return [
            'level' => $applicable['level'],
            'target' => $applicable['target'],
            'threshold' => $applicable['threshold'],
            'percent_used' => round($percentUsed, 1),
            'minutes_remaining' => max(0, $totalMinutes - $elapsedMinutes),
        ];
    }

    /**
     * Execute escalation: create alert + notify target.
     */
    private function escalate(WorkOrder $wo, array $escalation, int $tenantId): void
    {
        $alert = SystemAlert::create([
            'company_id' => $tenantId,
            'type' => "sla_escalation_{$escalation['level']}",
            'severity' => $escalation['level'] === 'breached' ? 'critical' : $escalation['level'],
            'title' => "SLA {$escalation['level']}: OS #{$wo->id}",
            'message' => "OS #{$wo->id} atingiu {$escalation['percent_used']}% do SLA. "
                . ($escalation['minutes_remaining'] > 0
                    ? "Restam {$escalation['minutes_remaining']} minutos."
                    : "PRAZO ESTOURADO."),
            'model_type' => WorkOrder::class,
            'model_id' => $wo->id,
            'metadata' => $escalation,
        ]);

        $targets = $this->resolveTargets($wo, $escalation['target'], $tenantId);

        foreach ($targets as $user) {
            try {
                $user->notify(new SlaEscalationNotification($wo, $escalation, $alert));
            } catch (\Throwable $e) {
                Log::warning("SLA notification failed for user {$user->id}: {$e->getMessage()}");
            }
        }

        Log::info("SLA Escalation: OS #{$wo->id} [{$escalation['level']}] → {$escalation['percent_used']}%");
    }

    /**
     * Escalate service call.
     */
    private function escalateServiceCall(ServiceCall $sc, array $escalation, int $tenantId): void
    {
        SystemAlert::create([
            'company_id' => $tenantId,
            'type' => "sla_sc_escalation_{$escalation['level']}",
            'severity' => $escalation['level'] === 'breached' ? 'critical' : $escalation['level'],
            'title' => "SLA {$escalation['level']}: Chamado #{$sc->id}",
            'message' => "Chamado #{$sc->id} atingiu {$escalation['percent_used']}% do SLA.",
            'model_type' => ServiceCall::class,
            'model_id' => $sc->id,
            'metadata' => $escalation,
        ]);
    }

    /**
     * Resolve notification targets based on escalation level.
     */
    private function resolveTargets(WorkOrder $wo, string $target, int $tenantId): array
    {
        return match ($target) {
            'assigned' => array_filter([$wo->assignedTo]),
            'supervisor' => User::where('company_id', $tenantId)
                ->whereHas('roles', fn ($q) => $q->where('name', 'supervisor'))
                ->get()->all(),
            'manager' => User::where('company_id', $tenantId)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['manager', 'admin']))
                ->get()->all(),
            'director' => User::where('company_id', $tenantId)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['admin', 'super-admin']))
                ->get()->all(),
            default => [],
        };
    }

    /**
     * Get SLA dashboard data for a tenant.
     */
    public function getDashboard(int $tenantId): array
    {
        $workOrders = WorkOrder::where('company_id', $tenantId)
            ->whereNotIn('status', ['cancelada'])
            ->whereNotNull('sla_deadline')
            ->get();

        $stats = ['on_time' => 0, 'at_risk' => 0, 'breached' => 0, 'total' => $workOrders->count()];

        foreach ($workOrders as $wo) {
            if (in_array($wo->status, ['concluida', 'faturada'])) {
                $completed = Carbon::parse($wo->data_conclusao ?? $wo->updated_at);
                $deadline = Carbon::parse($wo->sla_deadline);
                $completed->lte($deadline) ? $stats['on_time']++ : $stats['breached']++;
            } else {
                $eval = $this->evaluateSla($wo);
                if (!$eval || $eval['percent_used'] < 75) {
                    $stats['on_time']++;
                } elseif ($eval['percent_used'] < 100) {
                    $stats['at_risk']++;
                } else {
                    $stats['breached']++;
                }
            }
        }

        $stats['compliance_rate'] = $stats['total'] > 0
            ? round(($stats['on_time'] / $stats['total']) * 100, 1)
            : 100;

        return $stats;
    }

    private function alreadyEscalated(WorkOrder $wo, string $key): bool
    {
        return SystemAlert::where('model_type', WorkOrder::class)
            ->where('model_id', $wo->id)
            ->where('type', $key)
            ->where('created_at', '>=', Carbon::now()->subDay())
            ->exists();
    }

    private function alreadyEscalatedServiceCall(ServiceCall $sc, string $key): bool
    {
        return SystemAlert::where('model_type', ServiceCall::class)
            ->where('model_id', $sc->id)
            ->where('type', $key)
            ->where('created_at', '>=', Carbon::now()->subDay())
            ->exists();
    }
}
