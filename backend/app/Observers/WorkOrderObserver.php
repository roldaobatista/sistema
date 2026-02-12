<?php

namespace App\Observers;

use App\Models\WorkOrder;
use App\Models\SlaPolicy;
use App\Services\HolidayService;
use Illuminate\Support\Carbon;

class WorkOrderObserver
{
    public function creating(WorkOrder $workOrder): void
    {
        if ($workOrder->sla_policy_id) {
            $this->applySlaPolicy($workOrder);
        }
    }

    public function updating(WorkOrder $workOrder): void
    {
        if ($workOrder->isDirty('sla_policy_id') && $workOrder->sla_policy_id) {
            $this->applySlaPolicy($workOrder);
        }

        if ($workOrder->isDirty('status') && 
            $workOrder->status !== WorkOrder::STATUS_OPEN && 
            !$workOrder->sla_responded_at) {
            $workOrder->sla_responded_at = now();
        }
    }

    protected function applySlaPolicy(WorkOrder $workOrder): void
    {
        $policy = SlaPolicy::where('id', $workOrder->sla_policy_id)
            ->where('tenant_id', $workOrder->tenant_id)
            ->first();

        if (!$policy) {
            return;
        }

        $minutes = $policy->resolution_time_minutes;

        if ($workOrder->priority === WorkOrder::PRIORITY_URGENT) {
            $minutes = (int) ($minutes * 0.5);
        } elseif ($workOrder->priority === WorkOrder::PRIORITY_HIGH) {
            $minutes = (int) ($minutes * 0.8);
        }

        $holidayService = app(HolidayService::class);
        $workOrder->sla_due_at = $holidayService->addBusinessMinutes(Carbon::now(), $minutes);
    }
}
