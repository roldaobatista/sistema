<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecurringCommission extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'recurring_contract_id',
        'commission_rule_id', 'status', 'last_generated_at',
    ];

    protected function casts(): array
    {
        return [
            'last_generated_at' => 'date',
        ];
    }

    public const STATUS_ACTIVE = 'active';
    public const STATUS_PAUSED = 'paused';
    public const STATUS_TERMINATED = 'terminated';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function commissionRule(): BelongsTo
    {
        return $this->belongsTo(CommissionRule::class);
    }

    public function recurringContract(): BelongsTo
    {
        return $this->belongsTo(RecurringContract::class);
    }
}
