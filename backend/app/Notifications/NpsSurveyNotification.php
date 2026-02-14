<?php

namespace App\Notifications;

use App\Models\WorkOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NpsSurveyNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public WorkOrder $workOrder
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $tenantName = $this->workOrder->tenant->name ?? 'Kalibrium';
        $surveyUrl = config('app.frontend_url', 'http://localhost:3000') . "/feedback/nps/{$this->workOrder->id}";

        return (new MailMessage)
                    ->subject("Como foi seu atendimento na {$tenantName}? (OS #{$this->workOrder->number})")
                    ->greeting("Olá, " . $notifiable->name)
                    ->line("Sua Ordem de Serviço #{$this->workOrder->number} foi concluída com sucesso.")
                    ->line("Sua opinião é fundamental para melhorarmos nossos serviços. Gostaríamos de saber: de 0 a 10, o quanto você recomendaria a {$tenantName} para um amigo ou colega?")
                    ->action('Dar Feedback', $surveyUrl)
                    ->line("Agradecemos a confiança!");
    }
}
