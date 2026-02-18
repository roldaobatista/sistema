<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiscalNote extends Model
{
    use HasFactory;

    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_AUTHORIZED = 'authorized';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_REJECTED = 'rejected';

    const TYPE_NFE = 'nfe';
    const TYPE_NFSE = 'nfse';
    const TYPE_NFE_DEVOLUCAO = 'nfe_devolucao';
    const TYPE_NFE_COMPLEMENTAR = 'nfe_complementar';
    const TYPE_NFE_REMESSA = 'nfe_remessa';
    const TYPE_NFE_RETORNO = 'nfe_retorno';
    const TYPE_CTE = 'cte';

    protected $fillable = [
        'tenant_id',
        'type',
        'work_order_id',
        'quote_id',
        'parent_note_id',
        'customer_id',
        'number',
        'series',
        'access_key',
        'reference',
        'status',
        'provider',
        'provider_id',
        'total_amount',
        'nature_of_operation',
        'cfop',
        'items_data',
        'payment_data',
        'protocol_number',
        'environment',
        'contingency_mode',
        'email_retry_count',
        'last_email_sent_at',
        'verification_code',
        'issued_at',
        'cancelled_at',
        'cancel_reason',
        'pdf_url',
        'pdf_path',
        'xml_url',
        'xml_path',
        'error_message',
        'raw_response',
        'created_by',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'issued_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'last_email_sent_at' => 'datetime',
        'raw_response' => 'array',
        'items_data' => 'array',
        'payment_data' => 'array',
        'contingency_mode' => 'boolean',
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

    public function events(): HasMany
    {
        return $this->hasMany(FiscalEvent::class)->orderByDesc('created_at');
    }

    public function parentNote(): BelongsTo
    {
        return $this->belongsTo(FiscalNote::class, 'parent_note_id');
    }

    public function childNotes(): HasMany
    {
        return $this->hasMany(FiscalNote::class, 'parent_note_id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(FiscalAuditLog::class);
    }

    public function hasPdf(): bool
    {
        return ! empty($this->pdf_path) || ! empty($this->pdf_url);
    }

    public function hasXml(): bool
    {
        return ! empty($this->xml_path) || ! empty($this->xml_url);
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
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_PROCESSING]);
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

    public function canCorrect(): bool
    {
        return $this->type === self::TYPE_NFE && $this->status === self::STATUS_AUTHORIZED;
    }

    public function isNFe(): bool
    {
        return $this->type === self::TYPE_NFE;
    }

    public function isNFSe(): bool
    {
        return $this->type === self::TYPE_NFSE;
    }

    /**
     * Generate a unique reference for Focus NFe API.
     */
    public static function generateReference(string $type, int $tenantId): string
    {
        return "{$type}_{$tenantId}_" . now()->format('YmdHis') . '_' . mt_rand(100, 999);
    }
}
