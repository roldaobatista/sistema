<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ServiceCall extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $fillable = [
        'tenant_id', 'call_number', 'customer_id', 'quote_id',
        'technician_id', 'driver_id', 'status', 'priority',
        'scheduled_date', 'started_at', 'completed_at',
        'latitude', 'longitude', 'address', 'city', 'state', 'observations',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public const STATUSES = [
        'open' => ['label' => 'Aberto', 'color' => 'bg-blue-100 text-blue-700'],
        'scheduled' => ['label' => 'Agendado', 'color' => 'bg-amber-100 text-amber-700'],
        'in_transit' => ['label' => 'Em Deslocamento', 'color' => 'bg-cyan-100 text-cyan-700'],
        'in_progress' => ['label' => 'Em Atendimento', 'color' => 'bg-indigo-100 text-indigo-700'],
        'completed' => ['label' => 'Concluído', 'color' => 'bg-emerald-100 text-emerald-700'],
        'cancelled' => ['label' => 'Cancelado', 'color' => 'bg-red-100 text-red-700'],
    ];

    public const PRIORITIES = [
        'low' => ['label' => 'Baixa', 'color' => 'text-surface-500'],
        'normal' => ['label' => 'Normal', 'color' => 'text-blue-500'],
        'high' => ['label' => 'Alta', 'color' => 'text-amber-500'],
        'urgent' => ['label' => 'Urgente', 'color' => 'text-red-500'],
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function equipments(): BelongsToMany
    {
        return $this->belongsToMany(Equipment::class, 'service_call_equipments')
            ->withPivot('observations')
            ->withTimestamps();
    }

    public static function nextNumber(int $tenantId): string
    {
        $last = static::where('tenant_id', $tenantId)->orderByDesc('id')->value('call_number');
        $num = $last ? ((int) preg_replace('/\D/', '', $last)) + 1 : 1;
        return 'CT-' . str_pad($num, 5, '0', STR_PAD_LEFT);
    }

    // ── SLA ──

    public const SLA_HOURS = [
        'urgent' => 4,
        'high'   => 8,
        'normal' => 24,
        'low'    => 48,
    ];

    public function getResponseTimeMinutesAttribute(): ?int
    {
        if (!$this->started_at) return null;
        return (int) $this->created_at->diffInMinutes($this->started_at);
    }

    public function getResolutionTimeMinutesAttribute(): ?int
    {
        if (!$this->completed_at) return null;
        return (int) $this->created_at->diffInMinutes($this->completed_at);
    }

    public function getSlaBreachedAttribute(): bool
    {
        $limit = self::SLA_HOURS[$this->priority ?? 'normal'] ?? 24;
        $elapsed = $this->completed_at
            ? $this->created_at->diffInHours($this->completed_at)
            : $this->created_at->diffInHours(now());
        return $elapsed > $limit;
    }
}
