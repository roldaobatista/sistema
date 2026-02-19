<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToTenant;
use App\Traits\SyncsWithCentral;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkOrder extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes, Auditable, SyncsWithCentral;

    protected $appends = [
        'business_number',
        'waze_link',
        'google_maps_link',
    ];

    protected $fillable = [
        'tenant_id', 'os_number', 'number', 'customer_id', 'equipment_id',
        'quote_id', 'service_call_id', 'recurring_contract_id', 'seller_id', 'driver_id', 'origin_type', 'lead_source',
        'branch_id', 'created_by', 'assigned_to',
        'status', 'priority', 'description', 'internal_notes', 'technical_report',
        'received_at', 'started_at', 'completed_at', 'delivered_at',
        'discount', 'discount_percentage', 'discount_amount', 'displacement_value', 'total',
        'signature_path', 'signature_signer', 'signature_at', 'signature_ip',
        'checklist_id', 'sla_policy_id', 'sla_due_at', 'sla_responded_at',
        'dispatch_authorized_by', 'dispatch_authorized_at',
        'parent_id', 'is_master', 'is_warranty',
        'displacement_started_at', 'displacement_arrived_at', 'displacement_duration_minutes',
        'cancelled_at', 'cancellation_reason',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'delivered_at' => 'datetime',
            'signature_at' => 'datetime',
            'sla_due_at' => 'datetime',
            'sla_responded_at' => 'datetime',
            'displacement_started_at' => 'datetime',
            'displacement_arrived_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'discount' => 'decimal:2',
            'discount_percentage' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'displacement_value' => 'decimal:2',
            'total' => 'decimal:2',
            'is_master' => 'boolean',
            'is_warranty' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $workOrder): void {
            $workOrder->os_number = self::sanitizeOsNumber($workOrder->os_number);

            if (!$workOrder->os_number && $workOrder->number) {
                // Backward compatibility for integrations that do not pass os_number.
                $workOrder->os_number = $workOrder->number;
            }
        });

        static::updating(function (self $workOrder): void {
            if ($workOrder->isDirty('os_number')) {
                $workOrder->os_number = self::sanitizeOsNumber($workOrder->os_number);
            }
        });
    }

    public function businessNumber(): Attribute
    {
        return Attribute::get(fn (): string => (string) ($this->os_number ?: $this->number));
    }

    public function wazeLink(): Attribute
    {
        return Attribute::get(function () {
            if (!$this->customer) return null;
            $lat = $this->customer->latitude;
            $lng = $this->customer->longitude;
            if (!$lat || !$lng) return null;
            return "waze://?ll={$lat},{$lng}&navigate=yes";
        });
    }

    public function googleMapsLink(): Attribute
    {
        return Attribute::get(function () {
            if (!$this->customer) return null;
            $lat = $this->customer->latitude;
            $lng = $this->customer->longitude;
            if (!$lat || !$lng) return null;
            return "https://www.google.com/maps/search/?api=1&query={$lat},{$lng}";
        });
    }

    public const STATUS_OPEN = 'open';
    public const STATUS_AWAITING_DISPATCH = 'awaiting_dispatch';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_WAITING_PARTS = 'waiting_parts';
    public const STATUS_WAITING_APPROVAL = 'waiting_approval';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_INVOICED = 'invoiced';
    public const STATUS_CANCELLED = 'cancelled';

    // ── Origin Types ──
    public const ORIGIN_QUOTE = 'quote';
    public const ORIGIN_SERVICE_CALL = 'service_call';
    public const ORIGIN_RECURRING = 'recurring_contract'; // Updated to match RecurringContract usage
    public const ORIGIN_MANUAL = 'manual';
    public const ORIGIN_DIRECT = 'manual'; // Alias for legacy/frontend compatibility

    // ── Lead Sources (Commercial Origin — affects commission %) ──
    public const LEAD_SOURCES = [
        'prospeccao' => 'Prospecção',
        'retorno' => 'Retorno',
        'contato_direto' => 'Contato Direto',
        'indicacao' => 'Indicação',
    ];

    // ── Priority Constants ──
    public const PRIORITY_LOW = 'low';
    public const PRIORITY_NORMAL = 'normal';
    public const PRIORITY_HIGH = 'high';
    public const PRIORITY_URGENT = 'urgent';

    public const STATUSES = [
        self::STATUS_OPEN => ['label' => 'Aberta', 'color' => 'info'],
        self::STATUS_AWAITING_DISPATCH => ['label' => 'Aguard. Despacho', 'color' => 'amber'],
        self::STATUS_IN_PROGRESS => ['label' => 'Em Andamento', 'color' => 'warning'],
        self::STATUS_WAITING_PARTS => ['label' => 'Aguard. Peças', 'color' => 'warning'],
        self::STATUS_WAITING_APPROVAL => ['label' => 'Aguard. Aprovação', 'color' => 'brand'],
        self::STATUS_COMPLETED => ['label' => 'Concluída', 'color' => 'success'],
        self::STATUS_DELIVERED => ['label' => 'Entregue', 'color' => 'success'],
        self::STATUS_INVOICED => ['label' => 'Faturada', 'color' => 'brand'],
        self::STATUS_CANCELLED => ['label' => 'Cancelada', 'color' => 'danger'],
    ];

    public const PRIORITIES = [
        self::PRIORITY_LOW => ['label' => 'Baixa', 'color' => 'default'],
        self::PRIORITY_NORMAL => ['label' => 'Normal', 'color' => 'info'],
        self::PRIORITY_HIGH => ['label' => 'Alta', 'color' => 'warning'],
        self::PRIORITY_URGENT => ['label' => 'Urgente', 'color' => 'danger'],
    ];

    public const ALLOWED_TRANSITIONS = [
        self::STATUS_OPEN             => [self::STATUS_AWAITING_DISPATCH, self::STATUS_IN_PROGRESS, self::STATUS_CANCELLED],
        self::STATUS_AWAITING_DISPATCH => [self::STATUS_IN_PROGRESS, self::STATUS_CANCELLED],
        self::STATUS_IN_PROGRESS      => [self::STATUS_WAITING_PARTS, self::STATUS_WAITING_APPROVAL, self::STATUS_COMPLETED, self::STATUS_CANCELLED],
        self::STATUS_WAITING_PARTS    => [self::STATUS_IN_PROGRESS, self::STATUS_CANCELLED],
        self::STATUS_WAITING_APPROVAL => [self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED, self::STATUS_CANCELLED],
        self::STATUS_COMPLETED        => [self::STATUS_DELIVERED, self::STATUS_IN_PROGRESS, self::STATUS_CANCELLED],
        self::STATUS_DELIVERED        => [self::STATUS_INVOICED],
        self::STATUS_INVOICED         => [],
        self::STATUS_CANCELLED        => [self::STATUS_OPEN],
    ];

    public function canTransitionTo(string $newStatus): bool
    {
        $allowed = self::ALLOWED_TRANSITIONS[$this->status] ?? [];
        return in_array($newStatus, $allowed, true);
    }

    public static function nextNumber(int $tenantId): string
    {
        return \Illuminate\Support\Facades\DB::transaction(function () use ($tenantId) {
            $last = static::withTrashed()
                ->withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->lockForUpdate()
                ->max('number');
            $seq = $last ? (int) str_replace('OS-', '', $last) + 1 : 1;
            return 'OS-' . str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
        });
    }

    public function recalculateTotal(): void
    {
        $itemsTotal = (string) $this->items()->sum('total');

        // Apply EITHER percentage discount OR fixed discount — not both
        if ($this->discount_percentage > 0) {
            $discountAmount = bcmul($itemsTotal, bcdiv((string) $this->discount_percentage, '100', 4), 2);
        } else {
            $discountAmount = (string) ($this->discount ?? '0');
        }

        $displacement = (string) ($this->displacement_value ?? '0');

        $finalTotal = bcsub(bcadd($itemsTotal, $displacement, 2), $discountAmount, 2);

        $this->update([
            'total' => bccomp($finalTotal, '0', 2) < 0 ? '0.00' : $finalTotal,
            'discount_amount' => $discountAmount,
        ]);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(WorkOrder::class, 'parent_id');
    }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function equipment(): BelongsTo { return $this->belongsTo(Equipment::class); }
    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function assignee(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
    public function quote(): BelongsTo { return $this->belongsTo(Quote::class); }
    public function serviceCall(): BelongsTo { return $this->belongsTo(ServiceCall::class); }
    public function recurringContract(): BelongsTo { return $this->belongsTo(RecurringContract::class); }
    public function seller(): BelongsTo { return $this->belongsTo(User::class, 'seller_id'); }
    public function driver(): BelongsTo { return $this->belongsTo(User::class, 'driver_id'); }
    public function dispatchAuthorizer(): BelongsTo { return $this->belongsTo(User::class, 'dispatch_authorized_by'); }
    public function items(): HasMany { return $this->hasMany(WorkOrderItem::class); }
    public function statusHistory(): HasMany { return $this->hasMany(WorkOrderStatusHistory::class)->orderByDesc('created_at'); }

    public function checklist(): BelongsTo { return $this->belongsTo(ServiceChecklist::class); }
    public function checklistResponses(): HasMany { return $this->hasMany(WorkOrderChecklistResponse::class); }
    public function slaPolicy(): BelongsTo { return $this->belongsTo(SlaPolicy::class); }
    public function chats(): HasMany { return $this->hasMany(WorkOrderChat::class)->orderBy('created_at'); }
    public function satisfactionSurvey(): \Illuminate\Database\Eloquent\Relations\HasOne { return $this->hasOne(SatisfactionSurvey::class); }

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

    public function displacementStops(): HasMany
    {
        return $this->hasMany(WorkOrderDisplacementStop::class)->orderBy('started_at');
    }

    public function displacementLocations(): HasMany
    {
        return $this->hasMany(WorkOrderDisplacementLocation::class)->orderBy('recorded_at');
    }

    public function isTechnicianAuthorized(?int $userId): bool
    {
        if (!$userId) {
            return false;
        }
        if ((int) $this->assigned_to === $userId) {
            return true;
        }
        return $this->technicians()->where('user_id', $userId)->exists();
    }

    // GAP-23: Configurable warranty days (no hardcode)
    public static function warrantyDays(?int $tenantId = null): int
    {
        if ($tenantId) {
            $val = SystemSetting::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->where('key', 'warranty_days')
                ->value('value');
            if ($val !== null) {
                return max(0, (int) $val);
            }
        }
        return 90; // Fallback only
    }

    public function getWarrantyUntilAttribute(): ?\Carbon\Carbon
    {
        if (!$this->completed_at) {
            return null;
        }
        return $this->completed_at->copy()->addDays(self::warrantyDays($this->tenant_id));
    }

    public function getIsUnderWarrantyAttribute(): bool
    {
        return $this->warranty_until && $this->warranty_until->isFuture();
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(WorkOrderAttachment::class);
    }

    public function centralSyncData(): array
    {
        $statusMap = [
            self::STATUS_OPEN => \App\Enums\CentralItemStatus::ABERTO,
            self::STATUS_AWAITING_DISPATCH => \App\Enums\CentralItemStatus::ABERTO,
            self::STATUS_IN_PROGRESS => \App\Enums\CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_WAITING_PARTS => \App\Enums\CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_WAITING_APPROVAL => \App\Enums\CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_COMPLETED => \App\Enums\CentralItemStatus::CONCLUIDO,
            self::STATUS_DELIVERED => \App\Enums\CentralItemStatus::CONCLUIDO,
            self::STATUS_INVOICED => \App\Enums\CentralItemStatus::CONCLUIDO,
            self::STATUS_CANCELLED => \App\Enums\CentralItemStatus::CANCELADO,
        ];

        return [
            'status' => $statusMap[$this->status] ?? \App\Enums\CentralItemStatus::ABERTO,
            'titulo' => "OS #{$this->business_number} - {$this->customer?->name}",
        ];
    }

    private static function sanitizeOsNumber(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);
        return $normalized === '' ? null : $normalized;
    }
}
