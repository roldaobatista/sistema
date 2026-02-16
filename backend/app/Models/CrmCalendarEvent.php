<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\Auditable;

class CrmCalendarEvent extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_calendar_events';

    protected $fillable = [
        'tenant_id', 'user_id', 'title', 'description', 'type',
        'start_at', 'end_at', 'all_day', 'location', 'customer_id',
        'deal_id', 'activity_id', 'color', 'recurrence_rule',
        'external_id', 'external_provider', 'reminders',
    ];

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'all_day' => 'boolean',
            'reminders' => 'array',
        ];
    }

    public const TYPES = [
        'meeting' => 'Reunião',
        'call' => 'Ligação',
        'visit' => 'Visita',
        'deadline' => 'Prazo',
        'follow_up' => 'Follow-up',
        'contract_renewal' => 'Renovação Contrato',
        'calibration' => 'Calibração',
        'other' => 'Outro',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopeUpcoming($q, int $days = 7)
    {
        return $q->where('start_at', '>=', now())
            ->where('start_at', '<=', now()->addDays($days))
            ->orderBy('start_at');
    }

    public function scopeByUser($q, int $userId)
    {
        return $q->where('user_id', $userId);
    }

    public function scopeBetween($q, $start, $end)
    {
        return $q->where('start_at', '<=', $end)->where('end_at', '>=', $start);
    }

    // ─── Relationships ──────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(CrmDeal::class, 'deal_id');
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(CrmActivity::class, 'activity_id');
    }
}
