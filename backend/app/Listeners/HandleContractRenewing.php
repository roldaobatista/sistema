<?php

namespace App\Listeners;

use App\Events\ContractRenewing;
use App\Models\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;

class HandleContractRenewing implements ShouldQueue
{
    public function handle(ContractRenewing $event): void
    {
        $contract = $event->contract;
        $days = $event->daysUntilEnd;

        // Notificar responsável pelo contrato
        $notifyUserId = $contract->assigned_to ?? $contract->created_by;

        Notification::create([
            'tenant_id' => $contract->tenant_id,
            'user_id' => $notifyUserId,
            'type' => 'contract_renewing',
            'title' => 'Contrato Próximo do Vencimento',
            'message' => "O contrato \"{$contract->name}\" vence em {$days} dias. Cliente: {$contract->customer->name}.",
            'data' => [
                'recurring_contract_id' => $contract->id,
                'customer_id' => $contract->customer_id,
                'days_until_end' => $days,
            ],
        ]);
    }
}
