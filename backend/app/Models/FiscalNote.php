<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FiscalNote extends Model
{
    use HasFactory;

    const STATUS_PENDING = 'pending';
    const STATUS_AUTHORIZED = 'authorized';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_REJECTED = 'rejected';

    const TYPE_NFE = 'nfe';
    const TYPE_NFSE = 'nfse';

    protected $fillable = [
        'tenant_id',
        'type',
        'work_order_id',
        'quote_id',
        'customer_id',
        'number',
        'series',
        'access_key',
        'status',
        'provider',
        'provider_id',
        'total_amount',
        'issued_at',
        'cancelled_at',
        'cancel_reason',
        'pdf_url',
        'xml_url',
        'error_message',
        'raw_response',
        'created_by',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'issued_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'raw_response' => 'array',
    ];

    // ─── Relationships ──────────────────────────────

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ─── Scopes ─────────────────────────────────────

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeAuthorized($query)
    {
        return $query->where('status', self::STATUS_AUTHORIZED);
    }

    // ─── Helpers ────────────────────────────────────

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isAuthorized(): bool
    {
        return $this->status === self::STATUS_AUTHORIZED;
    }

    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }

    public function canCancel(): bool
    {
        return $this->status === self::STATUS_AUTHORIZED;
    }
}
