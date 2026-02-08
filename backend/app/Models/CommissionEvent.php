<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommissionEvent extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'commission_rule_id', 'work_order_id', 'user_id',
        'base_amount', 'commission_amount', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return ['base_amount' => 'decimal:2', 'commission_amount' => 'decimal:2'];
    }

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PAID = 'paid';
    public const STATUS_REVERSED = 'reversed';

    public const STATUSES = [
        self::STATUS_PENDING => ['label' => 'Pendente', 'color' => 'warning'],
        self::STATUS_APPROVED => ['label' => 'Aprovado', 'color' => 'info'],
        self::STATUS_PAID => ['label' => 'Pago', 'color' => 'success'],
        self::STATUS_REVERSED => ['label' => 'Estornado', 'color' => 'danger'],
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(CommissionRule::class, 'commission_rule_id');
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
