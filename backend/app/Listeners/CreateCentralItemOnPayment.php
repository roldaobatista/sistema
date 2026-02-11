<?php

namespace App\Listeners;

use App\Enums\CentralItemType;
use App\Events\PaymentReceived;
use App\Models\CentralItem;
use Illuminate\Contracts\Queue\ShouldQueue;

class CreateCentralItemOnPayment implements ShouldQueue
{
    public function handle(PaymentReceived $event): void
    {
        $payment = $event->payment;

        if (!$payment) {
            return;
        }

        $responsavel = $payment->received_by ?? auth()->id();

        CentralItem::criarDeOrigem(
            model: $payment,
            tipo: CentralItemType::FINANCEIRO,
            titulo: "Pagamento recebido — R$ " . number_format((float) ($payment->amount ?? 0), 2, ',', '.'),
            responsavelId: $responsavel,
            extras: [
                'descricao_curta' => $payment->notes ?? 'Pagamento registrado',
                'contexto' => [
                    'valor' => $payment->amount,
                    'metodo' => $payment->payment_method ?? null,
                    'link' => "/financeiro/recebimentos",
                ],
            ]
        );
    }
}
