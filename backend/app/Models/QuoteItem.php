<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class QuoteItem extends Model
{
    use BelongsToTenant, \Illuminate\Database\Eloquent\Factories\HasFactory;

    protected $appends = ['description'];

    protected $fillable = [
        'tenant_id', 'quote_equipment_id', 'type', 'product_id', 'service_id',
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
            $item->quoteEquipment?->quote?->recalculateTotal();
        });

        static::deleted(function (self $item) {
            $item->quoteEquipment?->quote?->recalculateTotal();
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

    public function getDescriptionAttribute(): ?string
    {
        if (!empty($this->custom_description)) {
            return $this->custom_description;
        }

        if ($this->product_id && $this->product) {
            return $this->product->name;
        }

        if ($this->service_id && $this->service) {
            return $this->service->name;
        }

        return null;
    }
}
