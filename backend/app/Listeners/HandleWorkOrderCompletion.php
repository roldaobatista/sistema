<?php

namespace App\Listeners;

use App\Events\WorkOrderCompleted;
use App\Models\Notification;
use App\Models\WorkOrder;
use App\Services\ClientNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;

class HandleWorkOrderCompletion implements ShouldQueue
{
    public function __construct(
        private ClientNotificationService $clientNotificationService,
    ) {}

    public function handle(WorkOrderCompleted $event): void
    {
        $wo = $event->workOrder;
        $user = $event->user;

        // Registrar no histórico
        $wo->statusHistory()->create([
            'tenant_id' => $wo->tenant_id,
            'user_id' => $user->id,
            'from_status' => $event->fromStatus,
            'to_status' => WorkOrder::STATUS_COMPLETED,
            'notes' => "OS concluída por {$user->name}",
        ]);

        // Notificar o responsável / admin (interno)
        Notification::notify(
            $wo->tenant_id,
            $wo->created_by,
            'os_completed',
            'OS Concluída',
            [
                'message' => "A OS {$wo->business_number} foi concluída por {$user->name}.",
                'data' => ['work_order_id' => $wo->id],
            ]
        );

        // Recalcular health score do cliente
        if ($wo->customer) {
            $wo->customer->recalculateHealthScore();
        }

        // Notificar cliente via email
        $this->clientNotificationService->notifyOsCompleted($wo);
    }
}


