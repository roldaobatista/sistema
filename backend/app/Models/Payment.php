<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use App\Models\Concerns\Auditable;

class Payment extends Model
{
    use BelongsToTenant, Auditable;

    protected $fillable = [
        'tenant_id', 'payable_type', 'payable_id', 'received_by',
        'amount', 'payment_method', 'payment_date', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'payment_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::created(function (self $payment) {
            $payable = $payment->payable;
            $payable->increment('amount_paid', $payment->amount);
            $payable->recalculateStatus();
        });

        static::deleted(function (self $payment) {
            $payable = $payment->payable;
            $payable->decrement('amount_paid', $payment->amount);
            $payable->recalculateStatus();
        });
    }

    public function payable(): MorphTo
    {
        return $this->morphTo();
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
