<?php

namespace App\Listeners;

use App\Events\WorkOrderCompleted;
use App\Notifications\NpsSurveyNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class TriggerNpsSurvey implements ShouldQueue
{
    use InteractsWithQueue;

    public function handle(WorkOrderCompleted $event): void
    {
        $workOrder = $event->workOrder;
        $customer = $workOrder->customer;

        if (!$customer || !$customer->email) {
            Log::info("NPS survey skipped: customer has no email", ['work_order_id' => $workOrder->id]);
            return;
        }

        try {
            // we notify the customer (or the main contact)
            $customer->notify(new NpsSurveyNotification($workOrder));
            Log::info("NPS survey triggered", ['work_order_id' => $workOrder->id, 'email' => $customer->email]);
        } catch (\Exception $e) {
            Log::error("Failed to trigger NPS survey", [
                'work_order_id' => $workOrder->id,
                'error' => $e->getMessage()
            ]);
        }
    }
}
