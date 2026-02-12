<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\WorkOrder;
use App\Services\HolidayService;
use Illuminate\Console\Command;

class CheckSlaBreaches extends Command
{
    protected $signature = 'sla:check-breaches';
    protected $description = 'Verifica e marca OS com SLA estourado, envia alertas';

    public function handle(HolidayService $holidayService): int
    {
        $breached = 0;

        $pendingResponse = WorkOrder::whereNotNull('sla_due_at')
            ->whereNull('sla_responded_at')
            ->where('sla_response_breached', false)
            ->whereHas('slaPolicy')
            ->with('slaPolicy')
            ->get();

        foreach ($pendingResponse as $wo) {
            $policy = $wo->slaPolicy;
            if (!$policy) continue;

            $responseDeadline = $holidayService->addBusinessMinutes(
                $wo->created_at,
                $policy->response_time_minutes
            );
            if (now()->greaterThan($responseDeadline)) {
                $wo->update(['sla_response_breached' => true]);
                $this->notifyBreach($wo, 'response', $policy->response_time_minutes);
                $breached++;
            }
        }

        // OS com SLA de resolução estourado
        $pendingResolution = WorkOrder::whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', now())
            ->where('sla_resolution_breached', false)
            ->whereNotIn('status', [WorkOrder::STATUS_COMPLETED, WorkOrder::STATUS_INVOICED, WorkOrder::STATUS_CANCELLED])
            ->get();

        foreach ($pendingResolution as $wo) {
            $wo->update(['sla_resolution_breached' => true]);
            $this->notifyBreach($wo, 'resolution', 0);
            $breached++;
        }

        $this->info("SLA breaches detectados: {$breached}");
        return self::SUCCESS;
    }

    private function notifyBreach(WorkOrder $wo, string $type, int $hours): void
    {
        $label = $type === 'response' ? 'Resposta' : 'Resolução';

        Notification::notify(
            $wo->tenant_id,
            $wo->assigned_to ?? $wo->created_by,
            'sla_breach',
            "SLA Estourado ({$label})",
            [
                'message' => "A OS {$wo->business_number} estourou o SLA de {$label}.",
                'icon' => 'alert-triangle',
                'color' => 'danger',
                'data' => [
                    'work_order_id' => $wo->id,
                    'breach_type' => $type,
                ],
            ]
        );
    }
}

