<?php

namespace App\Services\Search;

use App\Models\WorkOrderRecurrence;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WorkOrderRecurrenceService
{
    /**
     * Process all active recurrences that are due for generation.
     */
    public function processAll()
    {
        $dueRecurrences = WorkOrderRecurrence::where('is_active', true)
            ->where('next_generation_date', '<=', now()->toDateString())
            ->get();

        $count = 0;
        foreach ($dueRecurrences as $recurrence) {
            try {
                $this->generateWorkOrder($recurrence);
                $count++;
            } catch (\Exception $e) {
                Log::error("Failed to generate Work Order for recurrence {$recurrence->id}", [
                    'error' => $e->getMessage()
                ]);
            }
        }

        return $count;
    }

    /**
     * Generate a single Work Order from a recurrence.
     */
    public function generateWorkOrder(WorkOrderRecurrence $recurrence)
    {
        return DB::transaction(function () use ($recurrence) {
            // 1. Create the Work Order
            $workOrder = WorkOrder::create([
                'tenant_id' => $recurrence->tenant_id,
                'customer_id' => $recurrence->customer_id,
                'service_id' => $recurrence->service_id,
                'status' => 'open',
                'description' => $recurrence->description ?? "Gerada automaticamente: {$recurrence->name}",
                'origin' => 'recurrence',
                'metadata' => $recurrence->metadata,
            ]);

            // 2. Update Recurrence
            $recurrence->last_generated_at = now();
            $recurrence->next_generation_date = $this->calculateNextDate($recurrence);
            $recurrence->save();

            return $workOrder;
        });
    }

    /**
     * Calculate the next generation date based on frequency and interval.
     */
    protected function calculateNextDate(WorkOrderRecurrence $recurrence)
    {
        $date = Carbon::parse($recurrence->next_generation_date);

        switch ($recurrence->frequency) {
            case 'weekly':
                $date->addWeeks($recurrence->interval);
                if ($recurrence->day_of_week !== null) {
                    $date->setDayOfWeek($recurrence->day_of_week);
                }
                break;
            case 'monthly':
                $date->addMonths($recurrence->interval);
                if ($recurrence->day_of_month !== null) {
                    $date->setDay($recurrence->day_of_month);
                }
                break;
            case 'quarterly':
                $date->addMonths(3 * $recurrence->interval);
                break;
            case 'semi_annually':
                $date->addMonths(6 * $recurrence->interval);
                break;
            case 'annually':
                $date->addYears($recurrence->interval);
                break;
        }

        // Ensure we don't return a past date if somehow skipped
        if ($date->isPast()) {
            return $this->calculateNextDate($recurrence->replicate(['next_generation_date' => $date->toDateString()]));
        }

        return $date->toDateString();
    }
}
