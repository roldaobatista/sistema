<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseQuoteSupplier extends Model
{
    protected $fillable = [
        'purchase_quote_id', 'supplier_id', 'status',
        'total_price', 'delivery_days', 'conditions', 'item_prices', 'responded_at',
    ];

    protected $casts = [
        'total_price' => 'decimal:2',
        'item_prices' => 'array',
        'responded_at' => 'datetime',
    ];

    public function quote(): BelongsTo
    {
        return $this->belongsTo(PurchaseQuote::class, 'purchase_quote_id');
    }
}
