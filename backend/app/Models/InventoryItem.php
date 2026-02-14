<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryItem extends Model
{
    protected $fillable = [
        'inventory_id',
        'product_id',
        'batch_id',
        'product_serial_id',
        'expected_quantity',
        'counted_quantity',
        'adjustment_quantity',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'expected_quantity' => 'decimal:4',
            'counted_quantity' => 'decimal:4',
            'adjustment_quantity' => 'decimal:4',
        ];
    }

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function productSerial(): BelongsTo
    {
        return $this->belongsTo(ProductSerial::class);
    }

    /** Calcula a divergência */
    public function getDiscrepancyAttribute(): float
    {
        if ($this->counted_quantity === null) return 0;
        return $this->counted_quantity - $this->expected_quantity;
    }
}
