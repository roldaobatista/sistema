<?php

namespace App\Listeners;

use App\Events\PaymentMade;
use App\Models\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;

class HandlePaymentMade implements ShouldQueue
{
    public function handle(PaymentMade $event): void
    {
        $ap = $event->accountPayable;
        $payment = $event->payment;

        $paymentAmount = $payment ? (float) $payment->amount : (float) $ap->amount;
        $responsavel = $payment->received_by ?? null;

        if ($responsavel) {
            Notification::notify(
                $ap->tenant_id,
                $responsavel,
                'payment_made',
                'Pagamento Realizado',
                [
                    'message' => "Pagamento de R$ " . number_format($paymentAmount, 2, ',', '.') . " registrado para {$ap->description}.",
                    'icon' => 'arrow-up',
                    'color' => 'info',
                    'data' => ['account_payable_id' => $ap->id],
                ]
            );
        }
    }
}
