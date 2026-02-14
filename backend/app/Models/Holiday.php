<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class Holiday extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'date', 'is_national', 'is_recurring',
    ];

    protected $casts = [
        'date' => 'date',
        'is_national' => 'boolean',
        'is_recurring' => 'boolean',
    ];

    /**
     * Check if a given date is a holiday for this tenant.
     */
    public static function isHoliday(int $tenantId, string $date): bool
    {
        $dateObj = \Carbon\Carbon::parse($date);

        return static::where('tenant_id', $tenantId)
            ->where(function ($q) use ($dateObj) {
                $q->where('date', $dateObj->toDateString())
                    ->orWhere(function ($q2) use ($dateObj) {
                        $q2->where('is_recurring', true)
                            ->whereMonth('date', $dateObj->month)
                            ->whereDay('date', $dateObj->day);
                    });
            })
            ->exists();
    }
}
