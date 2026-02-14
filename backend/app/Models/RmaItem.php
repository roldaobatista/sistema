<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RmaItem extends Model
{
    protected $fillable = [
        'rma_request_id', 'product_id', 'quantity', 'defect_description', 'condition',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
    ];

    public function rmaRequest(): BelongsTo
    {
        return $this->belongsTo(RmaRequest::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
