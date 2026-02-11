<?php

namespace App\Listeners;

use App\Events\WorkOrderCancelled;
use App\Models\Notification;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Services\StockService;
use Illuminate\Contracts\Queue\ShouldQueue;

class HandleWorkOrderCancellation implements ShouldQueue
{
    public function __construct(
        private StockService $stockService,
    ) {}

    public function handle(WorkOrderCancelled $event): void
    {
        $wo = $event->workOrder;
        $user = $event->user;

        $wo->statusHistory()->create([
            'tenant_id' => $wo->tenant_id,
            'user_id' => $user->id,
            'from_status' => $wo->getOriginal('status'),
            'to_status' => WorkOrder::STATUS_CANCELLED,
            'notes' => "OS cancelada por {$user->name}. Motivo: {$event->reason}",
        ]);

        Notification::notify(
            $wo->tenant_id,
            $wo->created_by,
            'os_cancelled',
            'OS Cancelada',
            [
                'message' => "A OS {$wo->business_number} foi cancelada. Motivo: {$event->reason}",
                'icon' => 'x-circle',
                'color' => 'danger',
                'data' => ['work_order_id' => $wo->id, 'reason' => $event->reason],
            ]
        );

        // Devolver estoque reservado para itens tipo produto (com guard de idempotência)
        $alreadyCancelled = $wo->statusHistory()
            ->where('to_status', WorkOrder::STATUS_CANCELLED)
            ->count() > 1; // >1 pois o registro ATUAL já foi criado acima

        if (!$alreadyCancelled) {
            $productItems = $wo->items()->where('type', WorkOrderItem::TYPE_PRODUCT)->whereNotNull('reference_id')->get();
            foreach ($productItems as $item) {
                $product = \App\Models\Product::find($item->reference_id);
                if ($product && $product->track_stock) {
                    $this->stockService->returnStock($product, (float) $item->quantity, $wo);
                }
            }
        }
    }
}
