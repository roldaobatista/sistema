<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReconciliationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $tenantId,
        public string $action,
        public array $summary = [],
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->tenantId}.reconciliation"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'reconciliation.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'summary' => $this->summary,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
