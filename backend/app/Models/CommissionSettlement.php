<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommissionSettlement extends Model
{
    use BelongsToTenant, HasFactory, Auditable;

    protected $fillable = [
        'tenant_id', 'user_id', 'period', 'total_amount', 'events_count', 'status',
        'closed_by', 'closed_at', 'approved_by', 'approved_at', 'rejection_reason', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'paid_at' => 'date',
            'closed_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public const STATUS_OPEN = 'open';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_PENDING_APPROVAL = 'pending_approval';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_PAID = 'paid';

    public const STATUSES = [
        self::STATUS_OPEN => ['label' => 'Aberto', 'color' => 'warning'],
        self::STATUS_CLOSED => ['label' => 'Fechado', 'color' => 'info'],
        self::STATUS_PENDING_APPROVAL => ['label' => 'Aguard. Aprovação', 'color' => 'amber'],
        self::STATUS_APPROVED => ['label' => 'Aprovado', 'color' => 'success'],
        self::STATUS_REJECTED => ['label' => 'Rejeitado', 'color' => 'danger'],
        self::STATUS_PAID => ['label' => 'Pago', 'color' => 'success'],
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function events(): HasMany
    {
        return $this->hasMany(CommissionEvent::class, 'settlement_id');
    }

    /**
     * Eventos do período (fallback para quando settlement_id ainda não está preenchido).
     */
    public function eventsByPeriod(): HasMany
    {
        return $this->hasMany(CommissionEvent::class, 'user_id', 'user_id')
            ->where('tenant_id', $this->tenant_id)
            ->when($this->period, function ($q) {
                $driver = \Illuminate\Support\Facades\DB::getDriverName();
                if ($driver === 'sqlite') {
                    $q->whereRaw("strftime('%Y-%m', created_at) = ?", [$this->period]);
                } else {
                    $q->whereRaw("DATE_FORMAT(created_at, '%Y-%m') = ?", [$this->period]);
                }
            });
    }
}
