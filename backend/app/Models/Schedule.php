<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Schedule extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'work_order_id', 'customer_id', 'technician_id',
        'title', 'notes', 'scheduled_start', 'scheduled_end',
        'status', 'address',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_start' => 'datetime',
            'scheduled_end' => 'datetime',
        ];
    }

    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_SCHEDULED => ['label' => 'Agendado', 'color' => 'info'],
        self::STATUS_CONFIRMED => ['label' => 'Confirmado', 'color' => 'brand'],
        self::STATUS_COMPLETED => ['label' => 'Concluído', 'color' => 'success'],
        self::STATUS_CANCELLED => ['label' => 'Cancelado', 'color' => 'danger'],
    ];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    // ── Conflito de horários ──

    public static function hasConflict(
        int $technicianId,
        string $start,
        string $end,
        ?int $excludeId = null
    ): bool {
        return static::where('technician_id', $technicianId)
            ->where('status', '!=', self::STATUS_CANCELLED)
            ->where('scheduled_start', '<', $end)
            ->where('scheduled_end', '>', $start)
            ->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))
            ->exists();
    }
}
