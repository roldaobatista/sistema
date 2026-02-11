<?php

namespace App\Models;

use App\Enums\StockMovementType;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use BelongsToTenant, Auditable;

    protected $fillable = [
        'tenant_id',
        'product_id',
        'work_order_id',
        'type',
        'quantity',
        'unit_cost',
        'reference',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => StockMovementType::class,
            'quantity' => 'decimal:2',
            'unit_cost' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected static function booted(): void
    {
        static::created(function (StockMovement $movement) {
            $movement->applyToProductStock();
        });
    }

    /**
     * Aplica o delta desta movimentação ao stock_qty do produto.
     * Entry/Return incrementam; Exit/Reserve decrementam; Adjustment soma diretamente.
     */
    public function applyToProductStock(): void
    {
        $product = $this->product;
        if (!$product) {
            return;
        }

        $direction = $this->type->affectsStock();
        $delta = $direction === 0
            ? $this->quantity  // adjustment: qty já pode ser + ou -
            : $this->quantity * $direction;

        $product->update([
            'stock_qty' => $product->stock_qty + $delta,
        ]);
    }
}
