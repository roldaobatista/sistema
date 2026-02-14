<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class JourneyRule extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'daily_hours', 'weekly_hours',
        'overtime_weekday_pct', 'overtime_weekend_pct', 'overtime_holiday_pct',
        'night_shift_pct', 'night_start', 'night_end',
        'uses_hour_bank', 'hour_bank_expiry_months', 'is_default',
    ];

    protected $casts = [
        'daily_hours' => 'decimal:2',
        'weekly_hours' => 'decimal:2',
        'overtime_weekday_pct' => 'integer',
        'overtime_weekend_pct' => 'integer',
        'overtime_holiday_pct' => 'integer',
        'night_shift_pct' => 'integer',
        'hour_bank_expiry_months' => 'integer',
        'uses_hour_bank' => 'boolean',
        'is_default' => 'boolean',
    ];

    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }
}
