<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class PriceTableItem extends Model
{
    protected $fillable = [
        'price_table_id', 'priceable_type', 'priceable_id', 'price',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    public function priceTable(): BelongsTo
    {
        return $this->belongsTo(PriceTable::class);
    }

    public function priceable(): MorphTo
    {
        return $this->morphTo();
    }
}
