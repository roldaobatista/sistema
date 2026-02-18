<?php

namespace App\Notifications;

use App\Models\WorkOrder;
use App\Models\SystemAlert;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Messages\BroadcastMessage;

class SlaEscalationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public WorkOrder $workOrder,
        public array $escalation,
        public SystemAlert $alert,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'sla_escalation',
            'level' => $this->escalation['level'],
            'work_order_id' => $this->workOrder->id,
            'message' => "SLA {$this->escalation['level']}: OS #{$this->workOrder->id} at {$this->escalation['percent_used']}%",
            'alert_id' => $this->alert->id,
        ];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toDatabase($notifiable));
    }
}
