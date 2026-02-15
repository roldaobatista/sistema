<?php

namespace App\Listeners;

use App\Events\WorkOrderInvoiced;
use App\Models\Notification;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Services\CommissionService;
use App\Services\InvoicingService;
use App\Services\StockService;
use Illuminate\Contracts\Queue\ShouldQueue;

class HandleWorkOrderInvoicing implements ShouldQueue
{
    public function __construct(
        private InvoicingService $invoicingService,
        private StockService $stockService,
        private CommissionService $commissionService,
    ) {}

    public function handle(WorkOrderInvoiced $event): void
    {
        $wo = $event->workOrder;
        $user = $event->user;

        // 1. Registrar no histórico
        $wo->statusHistory()->create([
            'tenant_id' => $wo->tenant_id,
            'user_id' => $user->id,
            'from_status' => $event->fromStatus,
            'to_status' => WorkOrder::STATUS_INVOICED,
            'notes' => "OS faturada por {$user->name}",
        ]);

        // 2. Gerar Invoice + Conta a Receber
        $result = $this->invoicingService->generateFromWorkOrder($wo, $user->id);

        // 3. Baixa de estoque já realizada na criação dos itens (via WorkOrderItem observer)
        // Apenas para fins de consistência, poderíamos confirmar a saída, mas o movimento de reserva já baixou o saldo.

        // 4. Gerar comissões
        try {
            $this->commissionService->calculateAndGenerate($wo);
        } catch (\Exception) {
            // Comissões já geradas ou sem regras — não impede faturamento
        }

        // 5. Notificar equipe financeira
        Notification::notify(
            $wo->tenant_id,
            $wo->created_by,
            'os_invoiced',
            'OS Faturada',
            [
                'message' => "A OS {$wo->business_number} (R$ " . number_format((float) $wo->total, 2, ',', '.') . ") foi faturada. Fatura {$result['invoice']->invoice_number} gerada.",
                'icon' => 'receipt',
                'color' => 'success',
                'data' => [
                    'work_order_id' => $wo->id,
                    'invoice_id' => $result['invoice']->id,
                    'account_receivable_id' => $result['ar']->id,
                ],
            ]
        );
    }
}

