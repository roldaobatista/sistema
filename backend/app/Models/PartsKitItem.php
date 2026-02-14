<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartsKitItem extends Model
{
    protected $fillable = [
        'parts_kit_id', 'type', 'reference_id', 'description', 'quantity', 'unit_price',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
        ];
    }

    public function partsKit(): BelongsTo
    {
        return $this->belongsTo(PartsKit::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'reference_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'reference_id');
    }
}
