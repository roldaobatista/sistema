<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class WorkOrderItem extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'work_order_id',
        'type',
        'reference_id',
        'description',
        'quantity',
        'unit_price',
        'cost_price',
        'discount',
        'total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'cost_price' => 'decimal:2',
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

        // Auto-popular cost_price a partir do Product
        static::creating(function (self $item) {
            if ($item->type === 'product' && $item->reference_id && !$item->cost_price) {
                $item->cost_price = Product::where('id', $item->reference_id)->value('cost_price') ?? 0;
            }
        });

        // Recalcula total da OS + controle de estoque
        static::created(function (self $item) {
            $item->workOrder->recalculateTotal();
            if ($item->type === 'product' && $item->reference_id) {
                $product = Product::find($item->reference_id);
                if ($product && $product->stock_qty < $item->quantity) {
                    \Illuminate\Support\Facades\Log::warning("Estoque insuficiente: Produto #{$product->id} ({$product->name}) — disponível: {$product->stock_qty}, solicitado: {$item->quantity}");
                }
                Product::where('id', $item->reference_id)
                    ->decrement('stock_qty', (float) $item->quantity);
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
