<?php

namespace App\Listeners;

use App\Events\WorkOrderStarted;
use App\Models\Notification;
use App\Models\WorkOrder;
use Illuminate\Contracts\Queue\ShouldQueue;

class LogWorkOrderStartActivity implements ShouldQueue
{
    public function handle(WorkOrderStarted $event): void
    {
        $wo = $event->workOrder;
        $user = $event->user;

        $wo->statusHistory()->create([
            'tenant_id' => $wo->tenant_id,
            'user_id' => $user->id,
            'from_status' => $event->fromStatus,
            'to_status' => WorkOrder::STATUS_IN_PROGRESS,
            'notes' => "OS iniciada por {$user->name}",
        ]);

        if ($wo->assigned_to) {
            Notification::notify(
                $wo->tenant_id,
                $wo->assigned_to,
                'os_started',
                'OS Iniciada',
                [
                    'message' => "A OS {$wo->business_number} foi iniciada.",
                    'data' => ['work_order_id' => $wo->id],
                ]
            );
        }
    }
}

