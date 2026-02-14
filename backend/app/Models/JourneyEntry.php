<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class JourneyEntry extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'date', 'journey_rule_id',
        'scheduled_hours', 'worked_hours',
        'overtime_hours_50', 'overtime_hours_100',
        'night_hours', 'absence_hours', 'hour_bank_balance',
        'is_holiday', 'is_dsr', 'status', 'notes',
    ];

    protected $casts = [
        'date' => 'date',
        'scheduled_hours' => 'decimal:2',
        'worked_hours' => 'decimal:2',
        'overtime_hours_50' => 'decimal:2',
        'overtime_hours_100' => 'decimal:2',
        'night_hours' => 'decimal:2',
        'absence_hours' => 'decimal:2',
        'hour_bank_balance' => 'decimal:2',
        'is_holiday' => 'boolean',
        'is_dsr' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function journeyRule(): BelongsTo
    {
        return $this->belongsTo(JourneyRule::class);
    }

    public function scopeForMonth($query, int $userId, string $yearMonth)
    {
        [$year, $month] = explode('-', $yearMonth);
        return $query->where('user_id', $userId)
            ->whereYear('date', $year)
            ->whereMonth('date', $month);
    }

    public function scopeLocked($query)
    {
        return $query->where('status', 'locked');
    }

    public function getTotalOvertimeAttribute(): float
    {
        return bcadd($this->overtime_hours_50, $this->overtime_hours_100, 2);
    }
}
