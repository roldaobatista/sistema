<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\Auditable;

class CrmReferral extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_referrals';

    protected $fillable = [
        'tenant_id', 'referrer_customer_id', 'referred_customer_id',
        'deal_id', 'referred_name', 'referred_email', 'referred_phone',
        'status', 'reward_type', 'reward_value', 'reward_given',
        'converted_at', 'reward_given_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'reward_value' => 'decimal:2',
            'reward_given' => 'boolean',
            'converted_at' => 'datetime',
            'reward_given_at' => 'datetime',
        ];
    }

    public const STATUSES = [
        'pending' => 'Pendente',
        'contacted' => 'Contactado',
        'converted' => 'Convertido',
        'lost' => 'Não Convertido',
    ];

    public const REWARD_TYPES = [
        'discount' => 'Desconto na próxima calibração',
        'credit' => 'Crédito em conta',
        'gift' => 'Brinde',
        'none' => 'Sem recompensa',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopePending($q)
    {
        return $q->where('status', 'pending');
    }

    public function scopeConverted($q)
    {
        return $q->where('status', 'converted');
    }

    // ─── Relationships ──────────────────────────────────

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'referrer_customer_id');
    }

    public function referred(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'referred_customer_id');
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(CrmDeal::class, 'deal_id');
    }
}
