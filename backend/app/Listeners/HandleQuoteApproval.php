<?php

namespace App\Listeners;

use App\Events\QuoteApproved;
use App\Models\CrmActivity;
use App\Models\Notification;
use App\Models\Quote;
use Illuminate\Contracts\Queue\ShouldQueue;

class HandleQuoteApproval implements ShouldQueue
{
    public function handle(QuoteApproved $event): void
    {
        $quote = $event->quote;
        $user = $event->user;

        $quoteNumber = $quote->quote_number;
        $recipientId = $quote->seller_id ?? $user->id;

        // Registrar atividade CRM.
        if ($quote->customer_id) {
            CrmActivity::create([
                'tenant_id' => $quote->tenant_id,
                'customer_id' => $quote->customer_id,
                'user_id' => $user->id,
                'type' => Quote::ACTIVITY_TYPE_APPROVED,
                'title' => "Orcamento #{$quoteNumber} aprovado",
                'description' => 'Valor: R$ ' . number_format((float) $quote->total, 2, ',', '.'),
                'scheduled_at' => now(),
                'completed_at' => now(),
            ]);
        }

        // Notificar vendedor responsavel.
        Notification::create([
            'tenant_id' => $quote->tenant_id,
            'user_id' => $recipientId,
            'type' => Quote::ACTIVITY_TYPE_APPROVED,
            'title' => 'Orcamento Aprovado',
            'message' => "O orcamento #{$quoteNumber} foi aprovado.",
            'data' => ['quote_id' => $quote->id, 'total' => $quote->total],
        ]);
    }
}
