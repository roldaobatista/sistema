<?php

namespace App\Listeners;

use App\Enums\CentralItemPriority;
use App\Enums\CentralItemStatus;
use App\Enums\CentralItemType;
use App\Events\WorkOrderCompleted;
use App\Events\WorkOrderStarted;
use App\Models\CentralItem;
use App\Models\WorkOrder;
use Illuminate\Contracts\Queue\ShouldQueue;

class CreateCentralItemOnWorkOrder implements ShouldQueue
{
    public function handleWorkOrderStarted(WorkOrderStarted $event): void
    {
        $wo = $event->workOrder;

        $responsavel = $wo->assigned_to ?? $wo->created_by;

        CentralItem::criarDeOrigem(
            model: $wo,
            tipo: CentralItemType::OS,
            titulo: "OS #{$wo->business_number} — {$wo->customer?->name}",
            responsavelId: $responsavel,
            extras: [
                'prioridade' => $wo->priority === WorkOrder::PRIORITY_URGENT
                    ? CentralItemPriority::URGENTE
                    : CentralItemPriority::MEDIA,
                'due_at' => $wo->received_at,
                'contexto' => [
                    'numero' => $wo->business_number,
                    'cliente' => $wo->customer?->name,
                    'link' => "/os/{$wo->id}",
                ],
            ]
        );
    }

    public function handleWorkOrderCompleted(WorkOrderCompleted $event): void
    {
        $wo = $event->workOrder;

        CentralItem::syncFromSource($wo, [
            'status' => CentralItemStatus::CONCLUIDO,
            'closed_at' => now(),
            'closed_by' => $event->user?->id,
        ]);
    }

    /**
     * Registra quais eventos este listener escuta.
     */
    public function subscribe($events): array
    {
        return [
            WorkOrderStarted::class => 'handleWorkOrderStarted',
            WorkOrderCompleted::class => 'handleWorkOrderCompleted',
        ];
    }
}
