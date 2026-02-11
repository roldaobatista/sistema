<?php

namespace App\Listeners;

use App\Events\PaymentReceived;
use App\Models\Notification;
use App\Services\CommissionService;
use Illuminate\Contracts\Queue\ShouldQueue;

class HandlePaymentReceived implements ShouldQueue
{
    public function __construct(
        private CommissionService $commissionService,
    ) {}

    public function handle(PaymentReceived $event): void
    {
        $ar = $event->accountReceivable;
        $payment = $event->payment;

        // 1. Liberar comissões vinculadas
        $this->commissionService->releaseByPayment($ar);

        // 2. Notificar responsável
        $paymentAmount = $payment ? (float) $payment->amount : (float) $ar->amount;
        $responsavel = $payment->received_by ?? $ar->user_id ?? null;

        if ($responsavel) {
            Notification::notify(
                $ar->tenant_id,
                $responsavel,
                'payment_received',
                'Pagamento Recebido',
                [
                    'message' => "Pagamento de R$ " . number_format($paymentAmount, 2, ',', '.') . " recebido para {$ar->description}.",
                    'icon' => 'dollar-sign',
                    'color' => 'success',
                    'data' => ['account_receivable_id' => $ar->id],
                ]
            );
        }

        // 3. Recalcular health score do cliente
        if ($ar->customer_id) {
            $ar->customer?->recalculateHealthScore();
        }
    }
}
