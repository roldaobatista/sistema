<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuoteItem extends Model
{
    protected $fillable = [
        'quote_equipment_id', 'type', 'product_id', 'service_id',
        'custom_description', 'quantity', 'original_price', 'unit_price',
        'discount_percentage', 'subtotal', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'original_price' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'discount_percentage' => 'decimal:2',
            'subtotal' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (self $item) {
            $price = $item->unit_price;
            if ($item->discount_percentage > 0) {
                $price = $price * (1 - $item->discount_percentage / 100);
            }
            $item->subtotal = round($price * $item->quantity, 2);
        });

        static::saved(function (self $item) {
            $item->quoteEquipment->quote->recalculateTotal();
        });

        static::deleted(function (self $item) {
            $item->quoteEquipment->quote->recalculateTotal();
        });
    }

    public function quoteEquipment(): BelongsTo
    {
        return $this->belongsTo(QuoteEquipment::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }
}
