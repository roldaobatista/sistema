<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockDisposalItem extends Model
{
    protected $fillable = [
        'stock_disposal_id', 'product_id', 'quantity', 'unit_cost', 'batch_id', 'notes',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_cost' => 'decimal:4',
    ];

    public function disposal(): BelongsTo
    {
        return $this->belongsTo(StockDisposal::class, 'stock_disposal_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }
}
