<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class VacationBalance extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'acquisition_start', 'acquisition_end',
        'total_days', 'taken_days', 'sold_days', 'deadline', 'status',
    ];

    protected $casts = [
        'acquisition_start' => 'date',
        'acquisition_end' => 'date',
        'deadline' => 'date',
        'total_days' => 'integer',
        'taken_days' => 'integer',
        'sold_days' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getRemainingDaysAttribute(): int
    {
        return $this->total_days - $this->taken_days - $this->sold_days;
    }

    public function getIsExpiredAttribute(): bool
    {
        return $this->deadline && $this->deadline->isPast() && $this->remaining_days > 0;
    }
}
