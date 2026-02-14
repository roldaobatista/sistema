<?php

namespace App\Services;

use App\Models\TimeClockEntry;
use App\Models\JourneyEntry;
use App\Models\JourneyRule;
use App\Models\Holiday;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\Log;

class JourneyCalculationService
{
    /**
     * Calculate journey for a single user on a single day.
     */
    public function calculateDay(int $userId, string $date, int $tenantId): JourneyEntry
    {
        $dateObj = Carbon::parse($date);
        $rule = $this->getRuleForUser($userId, $tenantId);

        // Get all approved clock entries for this day
        $entries = TimeClockEntry::where('user_id', $userId)
            ->whereDate('clock_in', $date)
            ->whereNotNull('clock_out')
            ->where(function ($q) {
                $q->where('approval_status', 'auto_approved')
                    ->orWhere('approval_status', 'approved');
            })
            ->orderBy('clock_in')
            ->get();

        $workedMinutes = 0;
        $nightMinutes = 0;

        foreach ($entries as $entry) {
            $workedMinutes += $entry->clock_in->diffInMinutes($entry->clock_out);
            $nightMinutes += $this->calculateNightMinutes(
                $entry->clock_in,
                $entry->clock_out,
                $rule->night_start,
                $rule->night_end
            );
        }

        $workedHours = round($workedMinutes / 60, 2);
        $nightHours = round($nightMinutes / 60, 2);
        $scheduledHours = (float) $rule->daily_hours;

        $isHoliday = Holiday::isHoliday($tenantId, $date);
        $isSunday = $dateObj->isSunday();
        $isSaturday = $dateObj->isSaturday();
        $isDsr = $isSunday; // DSR = rest day (typically Sunday)

        // Calculate overtime
        $overtimeHours50 = 0;
        $overtimeHours100 = 0;
        $absenceHours = 0;

        if ($isHoliday || $isDsr) {
            // All hours worked on holiday/DSR are 100%
            $overtimeHours100 = $workedHours;
        } elseif ($isSaturday && $scheduledHours <= 4) {
            // Saturday with half-day: normal up to 4h, rest is 50%
            if ($workedHours > 4) {
                $overtimeHours50 = bcsub((string) $workedHours, '4', 2);
            }
        } else {
            // Regular day
            if ($workedHours > $scheduledHours) {
                $overtimeHours50 = bcsub((string) $workedHours, (string) $scheduledHours, 2);
            } elseif ($workedHours < $scheduledHours && $workedHours > 0) {
                $absenceHours = bcsub((string) $scheduledHours, (string) $workedHours, 2);
            } elseif ($workedHours == 0 && !$isSaturday && !$isSunday) {
                $absenceHours = $scheduledHours;
            }
        }

        // Hour bank calculation
        $hourBankBalance = 0;
        if ($rule->uses_hour_bank) {
            $previousBalance = JourneyEntry::where('user_id', $userId)
                ->where('date', '<', $date)
                ->orderByDesc('date')
                ->value('hour_bank_balance') ?? 0;

            $hourBankBalance = bcadd(
                (string) $previousBalance,
                bcsub((string) $overtimeHours50, (string) $absenceHours, 2),
                2
            );
        }

        return JourneyEntry::updateOrCreate(
            ['user_id' => $userId, 'date' => $date],
            [
                'tenant_id' => $tenantId,
                'journey_rule_id' => $rule->id,
                'scheduled_hours' => $scheduledHours,
                'worked_hours' => $workedHours,
                'overtime_hours_50' => max(0, $overtimeHours50),
                'overtime_hours_100' => max(0, $overtimeHours100),
                'night_hours' => $nightHours,
                'absence_hours' => max(0, $absenceHours),
                'hour_bank_balance' => $hourBankBalance,
                'is_holiday' => $isHoliday,
                'is_dsr' => $isDsr,
                'status' => 'calculated',
            ]
        );
    }

    /**
     * Calculate entire month for a user.
     */
    public function calculateMonth(int $userId, string $yearMonth, int $tenantId): array
    {
        [$year, $month] = explode('-', $yearMonth);
        $start = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $entries = [];
        foreach (CarbonPeriod::create($start, $end) as $day) {
            $entries[] = $this->calculateDay($userId, $day->toDateString(), $tenantId);
        }

        return $entries;
    }

    /**
     * Get monthly summary for a user.
     */
    public function getMonthSummary(int $userId, string $yearMonth): array
    {
        [$year, $month] = explode('-', $yearMonth);

        $entries = JourneyEntry::where('user_id', $userId)
            ->whereYear('date', $year)
            ->whereMonth('date', $month)
            ->get();

        return [
            'user_id' => $userId,
            'year_month' => $yearMonth,
            'total_scheduled' => $entries->sum('scheduled_hours'),
            'total_worked' => $entries->sum('worked_hours'),
            'total_overtime_50' => $entries->sum('overtime_hours_50'),
            'total_overtime_100' => $entries->sum('overtime_hours_100'),
            'total_night' => $entries->sum('night_hours'),
            'total_absence' => $entries->sum('absence_hours'),
            'hour_bank_balance' => $entries->last()?->hour_bank_balance ?? 0,
            'days_worked' => $entries->where('worked_hours', '>', 0)->count(),
            'days_absent' => $entries->where('absence_hours', '>', 0)->count(),
            'holidays' => $entries->where('is_holiday', true)->count(),
        ];
    }

    /**
     * Get current hour bank balance for a user.
     */
    public function getHourBankBalance(int $userId): float
    {
        return (float) (JourneyEntry::where('user_id', $userId)
            ->orderByDesc('date')
            ->value('hour_bank_balance') ?? 0);
    }

    /**
     * Calculate night work minutes between two timestamps.
     */
    private function calculateNightMinutes(Carbon $start, Carbon $end, string $nightStart, string $nightEnd): int
    {
        $nightMinutes = 0;

        $current = $start->copy();
        while ($current->lt($end)) {
            $nightStartTime = $current->copy()->setTimeFromTimeString($nightStart);
            $nightEndTime = $current->copy()->addDay()->setTimeFromTimeString($nightEnd);

            // If night starts before midnight
            if ($current->gte($nightStartTime) && $current->lt($nightEndTime)) {
                $overlapEnd = $end->lt($nightEndTime) ? $end : $nightEndTime;
                $nightMinutes += $current->diffInMinutes($overlapEnd);
                $current = $overlapEnd;
            } elseif ($current->lt($nightStartTime)) {
                // Skip to night start or end of work, whichever comes first
                $current = $end->lt($nightStartTime) ? $end : $nightStartTime;
            } else {
                break;
            }
        }

        return $nightMinutes;
    }

    /**
     * Get the journey rule for a user (default or assigned).
     */
    private function getRuleForUser(int $userId, int $tenantId): JourneyRule
    {
        // Future: allow per-user rule assignment
        // For now, use the default rule for the tenant
        $rule = JourneyRule::where('tenant_id', $tenantId)
            ->where('is_default', true)
            ->first();

        if (!$rule) {
            // Create a default rule if none exists
            $rule = JourneyRule::create([
                'tenant_id' => $tenantId,
                'name' => 'CLT Padrão',
                'daily_hours' => 8.00,
                'weekly_hours' => 44.00,
                'overtime_weekday_pct' => 50,
                'overtime_weekend_pct' => 100,
                'overtime_holiday_pct' => 100,
                'night_shift_pct' => 20,
                'night_start' => '22:00',
                'night_end' => '05:00',
                'uses_hour_bank' => false,
                'hour_bank_expiry_months' => 6,
                'is_default' => true,
            ]);
        }

        return $rule;
    }
}
