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

    public function events(): HasMany
    {
        return $this->hasMany(CommissionEvent::class, 'user_id', 'user_id')
            ->where('tenant_id', $this->tenant_id)
            ->when($this->period, function ($q) {
                // Ensure we only pick events that belong to this settlement's period
                // This assumes commission events created_at matches the settlement period
                // Ideally we should have a settlement_id on commission_events, but for now we filter by date
                $driver = \Illuminate\Support\Facades\DB::getDriverName();
                if ($driver === 'sqlite') {
                    $q->whereRaw("strftime('%Y-%m', created_at) = ?", [$this->period]);
                } else {
                    $q->whereRaw("DATE_FORMAT(created_at, '%Y-%m') = ?", [$this->period]);
                }
            });
    }
}
