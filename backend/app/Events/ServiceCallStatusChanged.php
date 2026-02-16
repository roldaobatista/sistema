<?php

namespace App\Events;

use App\Models\ServiceCall;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ServiceCallStatusChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /** @var ServiceCall Model for listeners (e.g. CreateCentralItemOnServiceCall) */
    public $serviceCall;

    /** @var string|null New status (for listeners) */
    public $toStatus;

    /** @var \App\Models\User|null User who changed (for listeners) */
    public $user;

    /**
     * @param ServiceCall $sc
     * @param string|null $oldStatus (optional)
     * @param string|null $newStatus (optional)
     * @param mixed $user (optional)
     */
    public function __construct(ServiceCall $sc, $oldStatus = null, $newStatus = null, $user = null)
    {
        $this->serviceCall = $sc;
        $this->toStatus = $newStatus ?? $sc->status;
        $this->user = $user;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('dashboard.' . $this->serviceCall->tenant_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'service_call.status.changed';
    }

    public function broadcastWith(): array
    {
        $sc = $this->serviceCall;
        $sc->loadMissing(['customer:id,name,latitude,longitude', 'technician:id,name']);

        return [
            'serviceCall' => [
                'id' => $sc->id,
                'status' => $sc->status,
                'priority' => $sc->priority,
                'subject' => $sc->subject ?? null,
                'customer' => $sc->customer ? [
                    'id' => $sc->customer->id,
                    'name' => $sc->customer->name,
                    'latitude' => $sc->customer->latitude,
                    'longitude' => $sc->customer->longitude,
                ] : null,
                'technician' => $sc->technician ? [
                    'id' => $sc->technician->id,
                    'name' => $sc->technician->name,
                ] : null,
                'tenant_id' => $sc->tenant_id,
            ],
        ];
    }
}
