<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\Auditable;

class CrmSequenceEnrollment extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_sequence_enrollments';

    protected $fillable = [
        'tenant_id', 'sequence_id', 'customer_id', 'deal_id',
        'current_step', 'status', 'next_action_at', 'completed_at',
        'paused_at', 'pause_reason', 'enrolled_by',
    ];

    protected function casts(): array
    {
        return [
            'current_step' => 'integer',
            'next_action_at' => 'datetime',
            'completed_at' => 'datetime',
            'paused_at' => 'datetime',
        ];
    }

    public const STATUSES = [
        'active' => 'Ativa',
        'completed' => 'Concluída',
        'paused' => 'Pausada',
        'cancelled' => 'Cancelada',
        'failed' => 'Falhou',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopeActive($q)
    {
        return $q->where('status', 'active');
    }

    public function scopePending($q)
    {
        return $q->where('status', 'active')
            ->whereNotNull('next_action_at')
            ->where('next_action_at', '<=', now());
    }

    // ─── Relationships ──────────────────────────────────

    public function sequence(): BelongsTo
    {
        return $this->belongsTo(CrmSequence::class, 'sequence_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(CrmDeal::class, 'deal_id');
    }

    public function enrolledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'enrolled_by');
    }
}
