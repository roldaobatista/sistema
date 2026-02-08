<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommissionSettlement extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'period', 'total_amount', 'events_count', 'status', 'paid_at',
    ];

    protected function casts(): array
    {
        return ['total_amount' => 'decimal:2', 'paid_at' => 'date'];
    }

    public const STATUS_OPEN = 'open';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_PAID = 'paid';

    public const STATUSES = [
        self::STATUS_OPEN => ['label' => 'Aberto', 'color' => 'warning'],
        self::STATUS_CLOSED => ['label' => 'Fechado', 'color' => 'info'],
        self::STATUS_PAID => ['label' => 'Pago', 'color' => 'success'],
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
