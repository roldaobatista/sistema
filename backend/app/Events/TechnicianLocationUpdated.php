<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TechnicianLocationUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $technician;

    /**
     * Create a new event instance.
     */
    public function __construct(User $user)
    {
        $this->technician = [
            'id' => $user->id,
            'name' => $user->name,
            'status' => $user->status,
            'location_lat' => $user->location_lat,
            'location_lng' => $user->location_lng,
            'location_updated_at' => $user->location_updated_at,
            'tenant_id' => $user->tenant_id ?? $user->current_tenant_id // Broadcast per tenant if needed
        ];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        // Broadcast to a public channel for the dashboard (or protected if we implement auth)
        // For simplicity in War Room context (TV), we often use a dedicated channel per tenant
        // or a global one if it's single tenant. Assuming Multi-tenant:
        
        $tenantId = $this->technician['tenant_id'];
        return [
            new Channel('dashboard.' . $tenantId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'technician.location.updated';
    }
}
