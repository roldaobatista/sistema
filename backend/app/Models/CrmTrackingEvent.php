<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class CrmTrackingEvent extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_tracking_events';

    protected $fillable = [
        'tenant_id', 'trackable_type', 'trackable_id', 'customer_id',
        'deal_id', 'event_type', 'ip_address', 'user_agent',
        'location', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public const EVENT_TYPES = [
        'email_opened',
        'email_clicked',
        'proposal_viewed',
        'proposal_downloaded',
        'link_clicked',
        'form_submitted',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopeByType($q, string $type)
    {
        return $q->where('event_type', $type);
    }

    // ─── Relationships ──────────────────────────────────

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(CrmDeal::class, 'deal_id');
    }

    public function trackable(): MorphTo
    {
        return $this->morphTo();
    }
}
