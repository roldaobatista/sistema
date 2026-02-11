<?php

namespace App\Listeners;

use App\Enums\CentralItemPriority;
use App\Enums\CentralItemStatus;
use App\Enums\CentralItemType;
use App\Events\ServiceCallCreated;
use App\Events\ServiceCallStatusChanged;
use App\Models\CentralItem;
use App\Models\ServiceCall;
use Illuminate\Contracts\Queue\ShouldQueue;

class CreateCentralItemOnServiceCall implements ShouldQueue
{
    public function handleCreated(ServiceCallCreated $event): void
    {
        $sc = $event->serviceCall;

        $responsavel = $sc->technician_id ?? $sc->created_by;

        CentralItem::criarDeOrigem(
            model: $sc,
            tipo: CentralItemType::CHAMADO,
            titulo: "Chamado #{$sc->call_number} — {$sc->customer?->name}",
            responsavelId: $responsavel,
            extras: [
                'prioridade' => match ($sc->priority ?? 'normal') {
                    'urgent' => CentralItemPriority::URGENTE,
                    'high' => CentralItemPriority::ALTA,
                    default => CentralItemPriority::MEDIA,
                },
                'due_at' => $sc->scheduled_date,
                'descricao_curta' => $sc->observations,
                'contexto' => [
                    'chamado_id' => $sc->id,
                    'cliente' => $sc->customer?->name,
                    'link' => "/chamados/{$sc->id}",
                ],
            ]
        );
    }

    public function handleStatusChanged(ServiceCallStatusChanged $event): void
    {
        $sc = $event->serviceCall;

        $finalStatuses = [ServiceCall::STATUS_COMPLETED, ServiceCall::STATUS_CANCELLED];

        if (in_array($event->toStatus, $finalStatuses)) {
            CentralItem::syncFromSource($sc, [
                'status' => $event->toStatus === ServiceCall::STATUS_CANCELLED
                    ? CentralItemStatus::CANCELADO
                    : CentralItemStatus::CONCLUIDO,
                'closed_at' => now(),
                'closed_by' => $event->user?->id,
            ]);
        } else {
            CentralItem::syncFromSource($sc, [
                'status' => CentralItemStatus::EM_ANDAMENTO,
            ]);
        }
    }

    public function subscribe($events): array
    {
        return [
            ServiceCallCreated::class => 'handleCreated',
            ServiceCallStatusChanged::class => 'handleStatusChanged',
        ];
    }
}
