<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quote extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $fillable = [
        'tenant_id', 'quote_number', 'customer_id', 'seller_id', 'status',
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

    public const STATUSES = [
        'draft' => ['label' => 'Rascunho', 'color' => 'bg-surface-100 text-surface-700'],
        'sent' => ['label' => 'Enviado', 'color' => 'bg-blue-100 text-blue-700'],
        'approved' => ['label' => 'Aprovado', 'color' => 'bg-emerald-100 text-emerald-700'],
        'rejected' => ['label' => 'Rejeitado', 'color' => 'bg-red-100 text-red-700'],
        'expired' => ['label' => 'Expirado', 'color' => 'bg-amber-100 text-amber-700'],
        'invoiced' => ['label' => 'Faturado', 'color' => 'bg-purple-100 text-purple-700'],
    ];

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
        $subtotal = 0;
        foreach ($this->equipments as $eq) {
            foreach ($eq->items as $item) {
                $subtotal += $item->subtotal;
            }
        }
        $this->subtotal = $subtotal;
        $discountAmount = $this->discount_percentage > 0
            ? $subtotal * ($this->discount_percentage / 100)
            : $this->discount_amount;
        $this->total = max(0, $subtotal - $discountAmount);
        $this->discount_amount = $discountAmount;
        $this->saveQuietly();
    }

    public function isExpired(): bool
    {
        return $this->valid_until && $this->valid_until->isPast() && $this->status === 'sent';
    }

    public static function nextNumber(int $tenantId): string
    {
        $last = static::where('tenant_id', $tenantId)
            ->orderByDesc('id')
            ->value('quote_number');
        $num = $last ? ((int) preg_replace('/\D/', '', $last)) + 1 : 1;
        return 'ORC-' . str_pad($num, 5, '0', STR_PAD_LEFT);
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
}
