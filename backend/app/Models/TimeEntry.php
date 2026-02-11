<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimeEntry extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'work_order_id', 'technician_id', 'schedule_id',
        'started_at', 'ended_at', 'duration_minutes', 'type', 'description',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public const TYPE_WORK = 'work';
    public const TYPE_TRAVEL = 'travel';
    public const TYPE_WAITING = 'waiting';

    public const TYPES = [
        self::TYPE_WORK => ['label' => 'Trabalho', 'color' => 'success'],
        self::TYPE_TRAVEL => ['label' => 'Deslocamento', 'color' => 'info'],
        self::TYPE_WAITING => ['label' => 'Espera', 'color' => 'warning'],
    ];

    protected static function booted(): void
    {
        static::saving(function (self $entry) {
            if ($entry->started_at && $entry->ended_at) {
                $entry->duration_minutes = (int) $entry->started_at->diffInMinutes($entry->ended_at);
            }
        });
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }
}
