<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class CrmInteractiveProposal extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_interactive_proposals';

    protected $fillable = [
        'tenant_id', 'quote_id', 'deal_id', 'token', 'status',
        'view_count', 'time_spent_seconds', 'item_interactions',
        'client_notes', 'client_signature', 'first_viewed_at',
        'last_viewed_at', 'accepted_at', 'rejected_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'item_interactions' => 'array',
            'view_count' => 'integer',
            'time_spent_seconds' => 'integer',
            'first_viewed_at' => 'datetime',
            'last_viewed_at' => 'datetime',
            'accepted_at' => 'datetime',
            'rejected_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public const STATUSES = [
        'draft' => 'Rascunho',
        'sent' => 'Enviada',
        'viewed' => 'Visualizada',
        'accepted' => 'Aceita',
        'rejected' => 'Rejeitada',
        'expired' => 'Expirada',
    ];

    // ─── Boot ───────────────────────────────────────────

    protected static function booted(): void
    {
        static::creating(function (self $proposal) {
            if (empty($proposal->token)) {
                $proposal->token = Str::random(64);
            }
        });
    }

    // ─── Methods ────────────────────────────────────────

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function recordView(): void
    {
        $this->increment('view_count');
        $this->update([
            'last_viewed_at' => now(),
            'first_viewed_at' => $this->first_viewed_at ?? now(),
            'status' => $this->status === 'sent' ? 'viewed' : $this->status,
        ]);
    }

    // ─── Relationships ──────────────────────────────────

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(CrmDeal::class, 'deal_id');
    }
}
