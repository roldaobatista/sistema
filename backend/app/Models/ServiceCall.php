<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\SyncsWithCentral;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ServiceCall extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable, SyncsWithCentral, \Illuminate\Database\Eloquent\Factories\HasFactory;

    protected $fillable = [
        'tenant_id', 'call_number', 'customer_id', 'quote_id',
        'contract_id', 'sla_policy_id', 'template_id',
        'technician_id', 'driver_id', 'created_by', 'status', 'priority',
        'scheduled_date', 'started_at', 'completed_at',
        'latitude', 'longitude', 'address', 'city', 'state', 'observations',
        'resolution_notes', 'reschedule_count', 'reschedule_reason', 'reschedule_history',
    ];

    protected $appends = [
        'sla_breached',
        'response_time_minutes',
        'resolution_time_minutes',
        'sla_remaining_minutes',
        'sla_limit_hours',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'reschedule_history' => 'array',
        ];
    }

    public const STATUS_OPEN = 'open';
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_IN_TRANSIT = 'in_transit';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_OPEN => ['label' => 'Aberto', 'color' => 'bg-blue-100 text-blue-700'],
        self::STATUS_SCHEDULED => ['label' => 'Agendado', 'color' => 'bg-amber-100 text-amber-700'],
        self::STATUS_IN_TRANSIT => ['label' => 'Em Trânsito', 'color' => 'bg-cyan-100 text-cyan-700'],
        self::STATUS_IN_PROGRESS => ['label' => 'Em Atendimento', 'color' => 'bg-indigo-100 text-indigo-700'],
        self::STATUS_COMPLETED => ['label' => 'Concluído', 'color' => 'bg-emerald-100 text-emerald-700'],
        self::STATUS_CANCELLED => ['label' => 'Cancelado', 'color' => 'bg-red-100 text-red-700'],
    ];

    public const PRIORITIES = [
        'low' => ['label' => 'Baixa', 'color' => 'text-surface-500'],
        'normal' => ['label' => 'Normal', 'color' => 'text-blue-500'],
        'high' => ['label' => 'Alta', 'color' => 'text-amber-500'],
        'urgent' => ['label' => 'Urgente', 'color' => 'text-red-500'],
    ];

    public const ALLOWED_TRANSITIONS = [
        self::STATUS_OPEN => [self::STATUS_SCHEDULED, self::STATUS_CANCELLED],
        self::STATUS_SCHEDULED => [self::STATUS_IN_TRANSIT, self::STATUS_OPEN, self::STATUS_CANCELLED],
        self::STATUS_IN_TRANSIT => [self::STATUS_IN_PROGRESS, self::STATUS_SCHEDULED, self::STATUS_CANCELLED],
        self::STATUS_IN_PROGRESS => [self::STATUS_COMPLETED, self::STATUS_CANCELLED],
        self::STATUS_COMPLETED => [],
        self::STATUS_CANCELLED => [self::STATUS_OPEN],
    ];

    public function canTransitionTo(string $newStatus): bool
    {
        $allowed = self::ALLOWED_TRANSITIONS[$this->status] ?? [];
        return in_array($newStatus, $allowed, true);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Contract::class);
    }

    public function slaPolicy(): BelongsTo
    {
        return $this->belongsTo(\App\Models\SlaPolicy::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(\App\Models\ServiceCallTemplate::class, 'template_id');
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function equipments(): BelongsToMany
    {
        return $this->belongsToMany(Equipment::class, 'service_call_equipments')
            ->withPivot('observations')
            ->withTimestamps();
    }

    public function comments(): HasMany
    {
        return $this->hasMany(ServiceCallComment::class)->orderByDesc('created_at');
    }

    public static function nextNumber(int $tenantId): string
    {
        $last = static::withTrashed()
            ->where('tenant_id', $tenantId)
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value('call_number');
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

    public function getSlaLimitHoursAttribute(): int
    {
        // Dynamic SLA: policy > default by priority
        if ($this->sla_policy_id && $this->relationLoaded('slaPolicy') && $this->slaPolicy) {
            return (int) ceil($this->slaPolicy->resolution_time_minutes / 60);
        }
        return self::SLA_HOURS[$this->priority ?? 'normal'] ?? 24;
    }

    /** Minutes remaining until SLA breach (negative = overdue). Null when completed/cancelled. */
    public function getSlaRemainingMinutesAttribute(): ?int
    {
        if (in_array($this->status, [self::STATUS_COMPLETED, self::STATUS_CANCELLED], true)) {
            return null;
        }
        $limitMinutes = ($this->sla_limit_hours ?? 24) * 60;
        $elapsedMinutes = (int) $this->created_at->diffInMinutes(now());
        return $limitMinutes - $elapsedMinutes;
    }

    // ── Central Sync ──

    public function centralSyncData(): array
    {
        $statusMap = [
            self::STATUS_OPEN => \App\Enums\CentralItemStatus::ABERTO,
            self::STATUS_SCHEDULED => \App\Enums\CentralItemStatus::ABERTO,
            self::STATUS_IN_TRANSIT => \App\Enums\CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_IN_PROGRESS => \App\Enums\CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_COMPLETED => \App\Enums\CentralItemStatus::CONCLUIDO,
            self::STATUS_CANCELLED => \App\Enums\CentralItemStatus::CANCELADO,
        ];

        return [
            'status' => $statusMap[$this->status] ?? \App\Enums\CentralItemStatus::ABERTO,
            'titulo' => "Chamado #{$this->call_number} — {$this->customer?->name}",
        ];
    }
}
