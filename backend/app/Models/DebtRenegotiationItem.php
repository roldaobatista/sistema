<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DebtRenegotiationItem extends Model
{
    protected $fillable = [
        'debt_renegotiation_id', 'account_receivable_id', 'original_amount',
    ];

    protected function casts(): array
    {
        return ['original_amount' => 'decimal:2'];
    }

    public function renegotiation(): BelongsTo { return $this->belongsTo(DebtRenegotiation::class); }
    public function receivable(): BelongsTo { return $this->belongsTo(AccountReceivable::class, 'account_receivable_id'); }
}
