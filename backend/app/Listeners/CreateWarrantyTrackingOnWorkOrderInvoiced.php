<?php

namespace App\Listeners;

use App\Events\WorkOrderCompleted;
use App\Events\WorkOrderInvoiced;
use App\Models\WarrantyTracking;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use Carbon\Carbon;
use Illuminate\Contracts\Queue\ShouldQueue;

class CreateWarrantyTrackingOnWorkOrderInvoiced implements ShouldQueue
{
    public const DEFAULT_WARRANTY_DAYS = 90;

    public function handleWorkOrderCompleted(WorkOrderCompleted $event): void
    {
        $this->createRecordsForWorkOrder($event->workOrder);
    }

    public function handleWorkOrderInvoiced(WorkOrderInvoiced $event): void
    {
        $this->createRecordsForWorkOrder($event->workOrder);
    }

    private function createRecordsForWorkOrder(WorkOrder $wo): void
    {
        $wo->load(['items' => fn ($q) => $q->where('type', WorkOrderItem::TYPE_PRODUCT)->whereNotNull('reference_id')]);

        $startDate = $wo->completed_at
            ? Carbon::parse($wo->completed_at)->toDateString()
            : now()->toDateString();

        foreach ($wo->items as $item) {
            $days = self::DEFAULT_WARRANTY_DAYS;

            WarrantyTracking::firstOrCreate(
                [
                    'work_order_id' => $wo->id,
                    'work_order_item_id' => $item->id,
                ],
                [
                    'tenant_id' => $wo->tenant_id,
                    'customer_id' => $wo->customer_id,
                    'equipment_id' => $wo->equipment_id,
                    'product_id' => $item->reference_id,
                    'warranty_start_at' => $startDate,
                    'warranty_end_at' => Carbon::parse($startDate)->addDays($days)->toDateString(),
                    'warranty_type' => WarrantyTracking::TYPE_PART,
                ]
            );
        }
    }
}
