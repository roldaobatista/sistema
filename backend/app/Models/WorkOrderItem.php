<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrderItem extends Model
{
    protected $fillable = [
        'work_order_id',
        'type',
        'reference_id',
        'description',
        'quantity',
        'unit_price',
        'discount',
        'total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        // Auto-calcula total ao salvar
        static::saving(function (self $item) {
            $item->total = max(0, ($item->quantity * $item->unit_price) - $item->discount);
        });

        // Recalcula total da OS + controle de estoque
        static::created(function (self $item) {
            $item->workOrder->recalculateTotal();
            if ($item->type === 'product' && $item->reference_id) {
                Product::where('id', $item->reference_id)
                    ->decrement('stock_qty', $item->quantity);
            }
        });

        static::updated(function (self $item) {
            $item->workOrder->recalculateTotal();
            if ($item->type === 'product' && $item->reference_id && $item->isDirty('quantity')) {
                $diff = $item->quantity - $item->getOriginal('quantity');
                if ($diff > 0) {
                    Product::where('id', $item->reference_id)->decrement('stock_qty', $diff);
                } elseif ($diff < 0) {
                    Product::where('id', $item->reference_id)->increment('stock_qty', abs($diff));
                }
            }
        });

        static::deleted(function (self $item) {
            $item->workOrder->recalculateTotal();
            if ($item->type === 'product' && $item->reference_id) {
                Product::where('id', $item->reference_id)
                    ->increment('stock_qty', $item->quantity);
            }
        });
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }
}
