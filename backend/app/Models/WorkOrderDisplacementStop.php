<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrderDisplacementStop extends Model
{
    public const TYPE_LUNCH = 'lunch';
    public const TYPE_HOTEL = 'hotel';
    public const TYPE_BR_STOP = 'br_stop';
    public const TYPE_OTHER = 'other';

    public const TYPES = [
        self::TYPE_LUNCH => 'Almoço',
        self::TYPE_HOTEL => 'Hotel',
        self::TYPE_BR_STOP => 'Parada BR',
        self::TYPE_OTHER => 'Outro',
    ];

    protected $fillable = [
        'work_order_id',
        'type',
        'started_at',
        'ended_at',
        'notes',
        'location_lat',
        'location_lng',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'location_lat' => 'float',
            'location_lng' => 'float',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function getDurationMinutesAttribute(): ?int
    {
        if (!$this->ended_at) {
            return null;
        }
        return (int) $this->started_at->diffInMinutes($this->ended_at);
    }
}
