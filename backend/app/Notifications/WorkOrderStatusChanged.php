<?php

namespace App\Notifications;

use App\Models\WorkOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class WorkOrderStatusChanged extends Notification
{
    use Queueable;

    public function __construct(
        public WorkOrder $workOrder,
        public string $oldStatus,
        public string $newStatus,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $statusLabels = [
            'open' => 'Aberta',
            'in_progress' => 'Em Andamento',
            'waiting_parts' => 'Aguardando Peças',
            'waiting_approval' => 'Aguardando Aprovação',
            'completed' => 'Concluída',
            'delivered' => 'Entregue',
            'cancelled' => 'Cancelada',
        ];

        $newLabel = $statusLabels[$this->newStatus] ?? $this->newStatus;
        $wo = $this->workOrder;

        return (new MailMessage)
            ->subject("OS #{$wo->number} — Status: {$newLabel}")
            ->greeting("Olá, {$notifiable->name}!")
            ->line("A OS **#{$wo->number}** teve o status alterado para **{$newLabel}**.")
            ->line("**Cliente:** {$wo->customer?->name}")
            ->line("**Descrição:** " . \Illuminate\Support\Str::limit($wo->description, 100))
            ->action('Ver OS', config('app.frontend_url') . "/os/{$wo->id}")
            ->line('Você recebeu este e-mail por ser responsável ou criador desta OS.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'work_order_id' => $this->workOrder->id,
            'number' => $this->workOrder->number,
            'old_status' => $this->oldStatus,
            'new_status' => $this->newStatus,
        ];
    }
}
