<?php

namespace App\Notifications;

use App\Models\AccountReceivable;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class PaymentOverdue extends Notification
{
    use Queueable;

    public function __construct(
        public AccountReceivable $receivable,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $r = $this->receivable;
        $dueDate = $r->due_date->format('d/m/Y');
        $amount = number_format($r->amount, 2, ',', '.');

        return (new MailMessage)
            ->subject("Título Vencido — R$ {$amount}")
            ->greeting("Olá, {$notifiable->name}!")
            ->line("O título **#{$r->id}** do cliente **{$r->customer?->name}** venceu em **{$dueDate}**.")
            ->line("**Valor:** R$ {$amount}")
            ->line("**Valor pago:** R$ " . number_format($r->amount_paid, 2, ',', '.'))
            ->action('Ver Financeiro', config('app.frontend_url') . '/financeiro/contas-a-receber')
            ->line('Entre em contato com o cliente para regularização.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'receivable_id' => $this->receivable->id,
            'customer_name' => $this->receivable->customer?->name,
            'amount' => $this->receivable->amount,
            'due_date' => $this->receivable->due_date->toDateString(),
        ];
    }
}
