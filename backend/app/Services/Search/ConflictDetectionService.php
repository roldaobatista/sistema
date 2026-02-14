<?php

namespace App\Services\Search;

use App\Models\Schedule;
use App\Models\CrmActivity;
use App\Models\ServiceCall;
use Carbon\Carbon;

class ConflictDetectionService
{
    /**
     * Check for conflicts across all scheduling sources.
     */
    public function check(int $technicianId, string $start, string $end, ?int $excludeScheduleId = null, ?int $tenantId = null)
    {
        $start = Carbon::parse($start);
        $end = Carbon::parse($end);

        // 1. Check Schedules
        $scheduleConflict = Schedule::where('technician_id', $technicianId)
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->where('status', '!=', Schedule::STATUS_CANCELLED)
            ->where('scheduled_start', '<', $end)
            ->where('scheduled_end', '>', $start)
            ->when($excludeScheduleId, fn ($q) => $q->where('id', '!=', $excludeScheduleId))
            ->first();

        if ($scheduleConflict) {
            return [
                'conflict' => true,
                'source' => 'schedule',
                'title' => $scheduleConflict->title,
                'details' => $scheduleConflict
            ];
        }

        // 2. Check CRM Activities (Meetings/Tasks)
        // Note: CRM activities usually have a single 'due_date'. We treat them as 1h duration for conflict.
        if (class_exists(CrmActivity::class)) {
            $crmConflict = CrmActivity::where('user_id', $technicianId)
                ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                ->whereIn('type', ['meeting', 'task'])
                ->where('due_date', '>=', $start->copy()->subMinutes(59))
                ->where('due_date', '<', $end)
                ->first();

            if ($crmConflict) {
                return [
                    'conflict' => true,
                    'source' => 'crm',
                    'title' => $crmConflict->subject,
                    'details' => $crmConflict
                ];
            }
        }

        // 3. Check Service Calls
        if (class_exists(ServiceCall::class)) {
            $callConflict = ServiceCall::where('technician_id', $technicianId)
                ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                ->where('scheduled_date', '<', $end)
                ->whereRaw('DATE_ADD(scheduled_date, INTERVAL 1 HOUR) > ?', [$start->toDateTimeString()])
                ->first();

            if ($callConflict) {
                return [
                    'conflict' => true,
                    'source' => 'service_call',
                    'title' => "Chamado #{$callConflict->call_number}",
                    'details' => $callConflict
                ];
            }
        }

        return ['conflict' => false];
    }
}
