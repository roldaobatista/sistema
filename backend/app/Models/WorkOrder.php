<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkOrder extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $fillable = [
        'tenant_id', 'os_number', 'number', 'customer_id', 'equipment_id',
        'quote_id', 'service_call_id', 'seller_id', 'driver_id', 'origin_type',
        'branch_id', 'created_by', 'assigned_to',
        'status', 'priority', 'description', 'internal_notes', 'technical_report',
        'received_at', 'started_at', 'completed_at', 'delivered_at',
        'discount', 'discount_percentage', 'discount_amount', 'displacement_value', 'total',
        'signature_path', 'signature_signer', 'signature_at', 'signature_ip',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'delivered_at' => 'datetime',
            'signature_at' => 'datetime',
            'discount' => 'decimal:2',
            'discount_percentage' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'displacement_value' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public const STATUS_OPEN = 'open';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_WAITING_PARTS = 'waiting_parts';
    public const STATUS_WAITING_APPROVAL = 'waiting_approval';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_INVOICED = 'invoiced';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_OPEN => ['label' => 'Aberta', 'color' => 'info'],
        self::STATUS_IN_PROGRESS => ['label' => 'Em Andamento', 'color' => 'warning'],
        self::STATUS_WAITING_PARTS => ['label' => 'Aguard. Peças', 'color' => 'warning'],
        self::STATUS_WAITING_APPROVAL => ['label' => 'Aguard. Aprovação', 'color' => 'brand'],
        self::STATUS_COMPLETED => ['label' => 'Concluída', 'color' => 'success'],
        self::STATUS_DELIVERED => ['label' => 'Entregue', 'color' => 'success'],
        self::STATUS_INVOICED => ['label' => 'Faturada', 'color' => 'brand'],
        self::STATUS_CANCELLED => ['label' => 'Cancelada', 'color' => 'danger'],
    ];

    public const PRIORITIES = [
        'low' => ['label' => 'Baixa', 'color' => 'default'],
        'normal' => ['label' => 'Normal', 'color' => 'info'],
        'high' => ['label' => 'Alta', 'color' => 'warning'],
        'urgent' => ['label' => 'Urgente', 'color' => 'danger'],
    ];

    public const ALLOWED_TRANSITIONS = [
        self::STATUS_OPEN             => [self::STATUS_IN_PROGRESS, self::STATUS_CANCELLED],
        self::STATUS_IN_PROGRESS      => [self::STATUS_WAITING_PARTS, self::STATUS_WAITING_APPROVAL, self::STATUS_COMPLETED, self::STATUS_CANCELLED],
        self::STATUS_WAITING_PARTS    => [self::STATUS_IN_PROGRESS, self::STATUS_CANCELLED],
        self::STATUS_WAITING_APPROVAL => [self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED, self::STATUS_CANCELLED],
        self::STATUS_COMPLETED        => [self::STATUS_DELIVERED, self::STATUS_IN_PROGRESS, self::STATUS_CANCELLED],
        self::STATUS_DELIVERED        => [self::STATUS_INVOICED],
        self::STATUS_INVOICED         => [],
        self::STATUS_CANCELLED        => [],
    ];

    public function canTransitionTo(string $newStatus): bool
    {
        $allowed = self::ALLOWED_TRANSITIONS[$this->status] ?? [];
        return in_array($newStatus, $allowed, true);
    }

    public static function nextNumber(int $tenantId): string
    {
        $last = static::withTrashed()->where('tenant_id', $tenantId)->max('number');
        $seq = $last ? (int) str_replace('OS-', '', $last) + 1 : 1;
        return 'OS-' . str_pad($seq, 6, '0', STR_PAD_LEFT);
    }

    public function recalculateTotal(): void
    {
        $itemsTotal = $this->items()->sum('total');
        $subtotal = max(0, $itemsTotal - ($this->discount ?? 0));
        $discountPercent = $this->discount_percentage > 0
            ? $subtotal * ($this->discount_percentage / 100) : 0;
        $this->update(['total' => max(0, $subtotal - $discountPercent), 'discount_amount' => $discountPercent]);
    }

    // ── Relationships ──

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function equipment(): BelongsTo { return $this->belongsTo(Equipment::class); }
    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function assignee(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
    public function quote(): BelongsTo { return $this->belongsTo(Quote::class); }
    public function serviceCall(): BelongsTo { return $this->belongsTo(ServiceCall::class); }
    public function seller(): BelongsTo { return $this->belongsTo(User::class, 'seller_id'); }
    public function driver(): BelongsTo { return $this->belongsTo(User::class, 'driver_id'); }
    public function items(): HasMany { return $this->hasMany(WorkOrderItem::class); }
    public function statusHistory(): HasMany { return $this->hasMany(WorkOrderStatusHistory::class)->orderByDesc('created_at'); }

    public function technicians(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'work_order_technicians')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function equipmentsList(): BelongsToMany
    {
        return $this->belongsToMany(Equipment::class, 'work_order_equipments')
            ->withPivot('observations')
            ->withTimestamps();
    }

    // ── Garantia ──

    public const WARRANTY_DAYS = 90;

    public function getWarrantyUntilAttribute(): ?\Carbon\Carbon
    {
        if (!$this->completed_at) return null;
        return $this->completed_at->copy()->addDays(self::WARRANTY_DAYS);
    }

    public function getIsUnderWarrantyAttribute(): bool
    {
        return $this->warranty_until && $this->warranty_until->isFuture();
    }

    // ── Anexos/Fotos ──

    public function attachments(): HasMany
    {
        return $this->hasMany(WorkOrderAttachment::class);
    }
}

