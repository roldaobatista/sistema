<?php

namespace App\Notifications;

use App\Models\Customer;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\DatabaseMessage;

class OverdueFollowUpNotification extends Notification
{
    use Queueable;

    public function __construct(
        private Customer $customer,
        private string $reason,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $messages = [
            'overdue_follow_up' => "O cliente {$this->customer->name} tem follow-up vencido.",
            'no_contact' => "O cliente {$this->customer->name} está sem contato há mais de 90 dias.",
        ];

        return [
            'title' => 'Follow-up pendente',
            'body' => $messages[$this->reason] ?? "Verificar cliente {$this->customer->name}.",
            'type' => 'follow_up_alert',
            'customer_id' => $this->customer->id,
            'customer_name' => $this->customer->name,
            'reason' => $this->reason,
            'url' => "/crm/clientes/{$this->customer->id}",
        ];
    }
}
