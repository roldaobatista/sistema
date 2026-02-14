<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseQuoteItem extends Model
{
    protected $fillable = [
        'purchase_quote_id', 'product_id', 'quantity', 'unit', 'specifications',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
    ];

    public function quote(): BelongsTo
    {
        return $this->belongsTo(PurchaseQuote::class, 'purchase_quote_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
