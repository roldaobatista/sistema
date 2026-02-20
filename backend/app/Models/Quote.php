<?php

namespace App\Models;

use App\Enums\PaymentTerms;
use App\Enums\QuoteStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use App\Traits\SyncsWithCentral;
use App\Enums\CentralItemStatus;
use App\Enums\CentralItemPriority;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quote extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable, SyncsWithCentral, \Illuminate\Database\Eloquent\Factories\HasFactory;

    // Backward-compatible constants
    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_INTERNAL = 'pending_internal_approval';
    public const STATUS_INTERNALLY_APPROVED = 'internally_approved';
    public const STATUS_SENT = 'sent';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_INVOICED = 'invoiced';

    /** Map used by PDF template (quote.blade.php) */
    public const STATUSES = [
        self::STATUS_DRAFT => ['label' => 'Rascunho', 'color' => 'gray'],
        self::STATUS_PENDING_INTERNAL => ['label' => 'Aguard. Aprovação Interna', 'color' => 'amber'],
        self::STATUS_INTERNALLY_APPROVED => ['label' => 'Aprovado Internamente', 'color' => 'teal'],
        self::STATUS_SENT => ['label' => 'Enviado', 'color' => 'blue'],
        self::STATUS_APPROVED => ['label' => 'Aprovado', 'color' => 'green'],
        self::STATUS_REJECTED => ['label' => 'Rejeitado', 'color' => 'red'],
        self::STATUS_EXPIRED => ['label' => 'Expirado', 'color' => 'amber'],
        self::STATUS_INVOICED => ['label' => 'Faturado', 'color' => 'indigo'],
    ];

    // GAP-03: Commercial source (affects seller commission %)
    public const SOURCES = [
        'prospeccao' => 'Prospecção',
        'retorno' => 'Retorno',
        'contato_direto' => 'Contato Direto',
        'indicacao' => 'Indicação',
    ];

    public const ACTIVITY_TYPE_APPROVED = 'quote_approved';

    protected $appends = ['approval_url'];

    protected $fillable = [
        'tenant_id', 'quote_number', 'revision', 'customer_id', 'seller_id', 'status',
        'source', 'valid_until', 'discount_percentage', 'discount_amount',
        'displacement_value',
        'subtotal', 'total', 'currency', 'observations', 'internal_notes',
        'payment_terms', 'payment_terms_detail', 'template_id', 'is_template',
        'opportunity_id', 'custom_fields',
        'internal_approved_by', 'internal_approved_at',
        'level2_approved_by', 'level2_approved_at',
        'sent_at', 'approved_at', 'rejected_at', 'rejection_reason',
        'last_followup_at', 'followup_count',
        'client_viewed_at', 'client_view_count',
    ];

    protected function casts(): array
    {
        return [
            'status' => QuoteStatus::class,
            'payment_terms' => PaymentTerms::class,
            'valid_until' => 'date',
            'discount_percentage' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'displacement_value' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'total' => 'decimal:2',
            'is_template' => 'boolean',
            'custom_fields' => 'array',
            'internal_approved_at' => 'datetime',
            'level2_approved_at' => 'datetime',
            'sent_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'last_followup_at' => 'datetime',
            'client_viewed_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function internalApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'internal_approved_by');
    }

    public function canSendToClient(): bool
    {
        return $this->status === QuoteStatus::INTERNALLY_APPROVED;
    }

    public function requiresInternalApproval(): bool
    {
        return $this->status === QuoteStatus::PENDING_INTERNAL_APPROVAL;
    }

    public function equipments(): HasMany
    {
        return $this->hasMany(QuoteEquipment::class)->orderBy('sort_order');
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function serviceCalls(): HasMany
    {
        return $this->hasMany(ServiceCall::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(QuoteTemplate::class, 'template_id');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(QuoteTag::class, 'quote_quote_tag');
    }

    public function emails(): HasMany
    {
        return $this->hasMany(QuoteEmail::class);
    }

    public function level2Approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'level2_approved_by');
    }

    // ── Margin & Installment helpers ──

    public function totalCost(): string
    {
        $this->loadMissing('equipments.items');
        $cost = '0.00';
        foreach ($this->equipments as $eq) {
            foreach ($eq->items as $item) {
                $itemCost = bcmul((string) $item->cost_price, (string) $item->quantity, 2);
                $cost = bcadd($cost, $itemCost, 2);
            }
        }
        return $cost;
    }

    public function profitMargin(): float
    {
        $total = (float) $this->total;
        if ($total <= 0) {
            return 0;
        }
        $cost = (float) $this->totalCost();
        return round((($total - $cost) / $total) * 100, 1);
    }

    public function installmentSimulation(): array
    {
        $total = (float) $this->total;
        $installments = [2, 3, 6, 10, 12];
        $result = [];
        foreach ($installments as $n) {
            $result[] = [
                'installments' => $n,
                'value' => round($total / $n, 2),
            ];
        }
        return $result;
    }

    public function requiresLevel2Approval(): bool
    {
        $threshold = QuoteApprovalThreshold::where('tenant_id', $this->tenant_id)
            ->where('is_active', true)
            ->where('required_level', 2)
            ->where('min_value', '<=', $this->total)
            ->where(function ($q) {
                $q->whereNull('max_value')
                  ->orWhere('max_value', '>=', $this->total);
            })
            ->first();

        return $threshold !== null;
    }

    public function recalculateTotal(): void
    {
        $this->load('equipments.items');

        $subtotal = '0.00';
        foreach ($this->equipments as $eq) {
            foreach ($eq->items as $item) {
                $subtotal = bcadd($subtotal, (string) $item->subtotal, 2);
            }
        }
        $this->subtotal = $subtotal;

        if ((float) $this->discount_percentage > 0) {
            $discountAmount = bcmul($subtotal, bcdiv((string) $this->discount_percentage, '100', 6), 2);
            $this->discount_amount = $discountAmount;
        } else {
            $discountAmount = (string) ($this->discount_amount ?? '0.00');
        }

        $displacement = (string) ($this->displacement_value ?? '0.00');
        $total = bcsub($subtotal, $discountAmount, 2);
        $total = bcadd($total, $displacement, 2);
        $this->total = bccomp($total, '0', 2) < 0 ? '0.00' : $total;
        $this->saveQuietly();
    }

    public function isExpired(): bool
    {
        return $this->valid_until && $this->valid_until->isPast() && $this->status === QuoteStatus::SENT;
    }

    public static function nextNumber(int $tenantId): string
    {
        $configuredStart = (int) (SystemSetting::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('key', 'quote_sequence_start')
            ->value('value') ?? 1);
        $configuredStart = max(1, $configuredStart);

        $historicalMax = static::withTrashed()
            ->where('tenant_id', $tenantId)
            ->pluck('quote_number')
            ->map(fn (?string $number): int => self::extractNumericSequence($number))
            ->max() ?? 0;

        $nextFromHistory = $historicalMax + 1;
        $next = max($configuredStart, $nextFromHistory);

        return 'ORC-' . str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }

    private static function extractNumericSequence(?string $number): int
    {
        if (!$number) {
            return 0;
        }

        if (!preg_match('/\d+/', $number, $matches)) {
            return 0;
        }

        return (int) ($matches[0] ?? 0);
    }

    // ── Link público de aprovação ──

    public function getApprovalTokenAttribute(): string
    {
        return hash_hmac('sha256', "quote-approve-{$this->id}", config('app.key'));
    }

    public function getApprovalUrlAttribute(): string
    {
        return url("/api/quotes/{$this->id}/public-approve?token={$this->approval_token}");
    }

    public static function verifyApprovalToken(int $quoteId, string $token): bool
    {
        $expected = hash_hmac('sha256', "quote-approve-{$quoteId}", config('app.key'));
        return hash_equals($expected, $token);
    }

    public function centralSyncData(): array
    {
        $statusMap = [
            self::STATUS_DRAFT => CentralItemStatus::ABERTO,
            self::STATUS_PENDING_INTERNAL => CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_INTERNALLY_APPROVED => CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_SENT => CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_APPROVED => CentralItemStatus::CONCLUIDO,
            self::STATUS_REJECTED => CentralItemStatus::CANCELADO,
            self::STATUS_EXPIRED => CentralItemStatus::CANCELADO,
            self::STATUS_INVOICED => CentralItemStatus::CONCLUIDO,
        ];

        $rawStatus = $this->status instanceof QuoteStatus ? $this->status->value : $this->status;

        return [
            'titulo' => "Orçamento #{$this->quote_number}",
            'status' => $statusMap[$rawStatus] ?? CentralItemStatus::ABERTO,
            'prioridade' => $rawStatus === self::STATUS_SENT ? CentralItemPriority::ALTA : CentralItemPriority::MEDIA,
        ];
    }
}
