<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FiscalEvent extends Model
{
    protected $fillable = [
        'fiscal_note_id',
        'tenant_id',
        'event_type',
        'protocol_number',
        'description',
        'request_payload',
        'response_payload',
        'status',
        'error_message',
        'user_id',
    ];

    protected $casts = [
        'request_payload' => 'array',
        'response_payload' => 'array',
    ];

    // ─── Relationships ──────────────────────────────

    public function fiscalNote(): BelongsTo
    {
        return $this->belongsTo(FiscalNote::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ─── Scopes ─────────────────────────────────────

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('event_type', $type);
    }
}
