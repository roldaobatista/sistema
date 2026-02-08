<?php

namespace App\Events;

use App\Models\Notification;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $notification;
    public int $tenantId;
    public ?int $userId;

    public function __construct(array $notificationData, int $tenantId, ?int $userId = null)
    {
        $this->notification = $notificationData;
        $this->tenantId = $tenantId;
        $this->userId = $userId;
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel("tenant.{$this->tenantId}.notifications"),
        ];

        if ($this->userId) {
            $channels[] = new PrivateChannel("user.{$this->userId}.notifications");
        }

        return $channels;
    }

    public function broadcastWith(): array
    {
        return [
            'notification' => $this->notification,
            'timestamp' => now()->toISOString(),
        ];
    }

    public function broadcastAs(): string
    {
        return 'notification.new';
    }
}
