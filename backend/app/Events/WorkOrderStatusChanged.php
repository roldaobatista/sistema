<?php

namespace App\Events;

use App\Models\WorkOrder;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WorkOrderStatusChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $workOrder;

    public function __construct(WorkOrder $wo)
    {
        $wo->loadMissing(['customer:id,name,latitude,longitude', 'assignee:id,name']);

        $this->workOrder = [
            'id' => $wo->id,
            'os_number' => $wo->os_number,
            'status' => $wo->status,
            'started_at' => $wo->started_at,
            'completed_at' => $wo->completed_at,
            'customer' => $wo->customer ? [
                'id' => $wo->customer->id,
                'name' => $wo->customer->name,
                'latitude' => $wo->customer->latitude,
                'longitude' => $wo->customer->longitude,
            ] : null,
            'technician' => $wo->assignee ? [
                'id' => $wo->assignee->id,
                'name' => $wo->assignee->name,
            ] : null,
            'tenant_id' => $wo->tenant_id,
        ];
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('dashboard.' . $this->workOrder['tenant_id']),
        ];
    }

    public function broadcastAs(): string
    {
        return 'work_order.status.changed';
    }
}
