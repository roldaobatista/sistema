<?php

namespace App\Services;

use App\Models\SatisfactionSurvey;
use App\Models\Tenant;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\Log;

class PostServiceSurveyService
{
    public function __construct(
        private ?WhatsAppService $whatsApp = null,
        private ?ClientNotificationService $notification = null,
    ) {}

    /**
     * Envia pesquisa de satisfação para OS concluídas nas últimas 24h que ainda não têm survey.
     */
    public function processForTenant(Tenant $tenant): int
    {
        $sent = 0;

        $workOrders = WorkOrder::where('tenant_id', $tenant->id)
            ->where('status', 'completed')
            ->where('completed_at', '>=', now()->subDay())
            ->whereDoesntHave('satisfactionSurvey')
            ->with(['customer'])
            ->get();

        foreach ($workOrders as $wo) {
            if (!$wo->customer) {
                continue;
            }

            try {
                $survey = SatisfactionSurvey::create([
                    'tenant_id' => $tenant->id,
                    'customer_id' => $wo->customer_id,
                    'work_order_id' => $wo->id,
                    'channel' => 'whatsapp',
                ]);

                $surveyUrl = config('app.frontend_url') . "/portal/pesquisa/{$survey->id}?token=" . encrypt($survey->id);

                // Tenta WhatsApp
                if ($this->whatsApp && $wo->customer->phone) {
                    $this->whatsApp->sendText(
                        $tenant,
                        $wo->customer->phone,
                        "Olá {$wo->customer->name}! Sua OS #{$wo->number} foi concluída. " .
                        "Avalie nosso atendimento: {$surveyUrl}"
                    );
                }

                // Notificação interna
                if ($this->notification) {
                    $this->notification->notify(
                        $wo->customer,
                        'survey_sent',
                        "Pesquisa de satisfação enviada para OS #{$wo->number}"
                    );
                }

                $sent++;
            } catch (\Throwable $e) {
                Log::warning("Falha ao enviar pesquisa para OS #{$wo->id}: {$e->getMessage()}");
            }
        }

        return $sent;
    }
}
