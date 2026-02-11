<?php

namespace App\Models;

use App\Enums\QuoteStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use App\Traits\SyncsWithCentral;
use App\Enums\CentralItemStatus;
use App\Enums\CentralItemPriority;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quote extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable, SyncsWithCentral, \Illuminate\Database\Eloquent\Factories\HasFactory;

    // Backward-compatible constants
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SENT = 'sent';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_INVOICED = 'invoiced';

    /** Map used by PDF template (quote.blade.php) */
    public const STATUSES = [
        self::STATUS_DRAFT => ['label' => 'Rascunho', 'color' => 'gray'],
        self::STATUS_SENT => ['label' => 'Enviado', 'color' => 'blue'],
        self::STATUS_APPROVED => ['label' => 'Aprovado', 'color' => 'green'],
        self::STATUS_REJECTED => ['label' => 'Rejeitado', 'color' => 'red'],
        self::STATUS_EXPIRED => ['label' => 'Expirado', 'color' => 'amber'],
        self::STATUS_INVOICED => ['label' => 'Faturado', 'color' => 'purple'],
    ];

    public const ACTIVITY_TYPE_APPROVED = 'quote_approved';

    protected $fillable = [
        'tenant_id', 'quote_number', 'revision', 'customer_id', 'seller_id', 'status',
        'valid_until', 'discount_percentage', 'discount_amount',
        'subtotal', 'total', 'observations', 'internal_notes',
        'sent_at', 'approved_at', 'rejected_at', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'valid_until' => 'date',
            'discount_percentage' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'total' => 'decimal:2',
            'sent_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
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

    public function equipments(): HasMany
    {
        return $this->hasMany(QuoteEquipment::class)->orderBy('sort_order');
    }

    public function recalculateTotal(): void
    {
        $this->load('equipments.items');

        $subtotal = 0;
        foreach ($this->equipments as $eq) {
            foreach ($eq->items as $item) {
                $subtotal += $item->subtotal;
            }
        }
        $this->subtotal = $subtotal;

        if ($this->discount_percentage > 0) {
            $discountAmount = $subtotal * ($this->discount_percentage / 100);
            $this->discount_amount = $discountAmount;
        } else {
            $discountAmount = (float) ($this->discount_amount ?? 0);
        }

        $this->total = max(0, $subtotal - $discountAmount);
        $this->saveQuietly();
    }

    public function isExpired(): bool
    {
        return $this->valid_until && $this->valid_until->isPast() && $this->status === QuoteStatus::SENT->value;
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
            self::STATUS_SENT => CentralItemStatus::EM_ANDAMENTO,
            self::STATUS_APPROVED => CentralItemStatus::CONCLUIDO,
            self::STATUS_REJECTED => CentralItemStatus::CANCELADO,
            self::STATUS_EXPIRED => CentralItemStatus::CANCELADO,
            self::STATUS_INVOICED => CentralItemStatus::CONCLUIDO,
        ];

        return [
            'titulo' => "Orçamento #{$this->quote_number}",
            'status' => $statusMap[$this->status] ?? CentralItemStatus::ABERTO,
            'prioridade' => in_array($this->status, [self::STATUS_SENT]) ? CentralItemPriority::ALTA : CentralItemPriority::MEDIA,
        ];
    }
}
