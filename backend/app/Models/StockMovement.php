<?php

namespace App\Models;

use App\Enums\StockMovementType;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;
use App\Models\WarehouseStock;

class StockMovement extends Model
{
    use BelongsToTenant, Auditable;

    protected $fillable = [
        'tenant_id',
        'product_id',
        'work_order_id',
        'warehouse_id',
        'batch_id',
        'product_serial_id',
        'target_warehouse_id',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function targetWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'target_warehouse_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function productSerial(): BelongsTo
    {
        return $this->belongsTo(ProductSerial::class, 'product_serial_id');
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

        DB::transaction(function () use ($product) {
            if ($this->type === StockMovementType::Transfer) {
                $this->handleTransfer();
            } else {
                $this->handleRegularMovement();
            }

            // Atualiza saldo global cacheado no produto para compatibilidade e performance de listagem
            $product->update([
                'stock_qty' => WarehouseStock::where('product_id', $product->id)->sum('quantity'),
            ]);
        });
    }

    protected function handleRegularMovement(): void
    {
        $direction = $this->type->affectsStock();
        $delta = $direction === 0 ? $this->quantity : $this->quantity * $direction;

        $stock = WarehouseStock::firstOrCreate([
            'warehouse_id' => $this->warehouse_id,
            'product_id' => $this->product_id,
            'batch_id' => $this->batch_id,
        ]);

        $stock->increment('quantity', $delta);
    }

    protected function handleTransfer(): void
    {
        if (!$this->warehouse_id || !$this->target_warehouse_id) {
            return;
        }

        // Saída do armazém de origem
        $sourceStock = WarehouseStock::firstOrCreate([
            'warehouse_id' => $this->warehouse_id,
            'product_id' => $this->product_id,
            'batch_id' => $this->batch_id,
        ]);
        $sourceStock->decrement('quantity', $this->quantity);

        // Entrada no armazém de destino
        $targetStock = WarehouseStock::firstOrCreate([
            'warehouse_id' => $this->target_warehouse_id,
            'product_id' => $this->product_id,
            'batch_id' => $this->batch_id,
        ]);
        $targetStock->increment('quantity', $this->quantity);
    }
}
