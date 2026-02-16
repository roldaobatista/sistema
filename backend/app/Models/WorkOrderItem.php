<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class WorkOrderItem extends Model
{
    use BelongsToTenant, HasFactory;

    public const TYPE_PRODUCT = 'product';
    public const TYPE_SERVICE = 'service';

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
            $subtotal = bcmul((string) $item->quantity, (string) $item->unit_price, 2);
            $result = bcsub($subtotal, (string) ($item->discount ?? 0), 2);
            $item->total = bccomp($result, '0', 2) < 0 ? '0.00' : $result;
        });

        // Auto-popular cost_price a partir do Product
        static::creating(function (self $item) {
            if ($item->type === self::TYPE_PRODUCT && $item->reference_id && !$item->cost_price) {
                $item->cost_price = Product::where('id', $item->reference_id)->value('cost_price') ?? 0;
            }
        });

        // Recalcula total da OS + controle de estoque via StockService
        static::created(function (self $item) {
            $item->workOrder->recalculateTotal();
            if ($item->type === self::TYPE_PRODUCT && $item->reference_id) {
                $product = \App\Models\Product::find($item->reference_id);
                if ($product && $product->track_stock) {
                    // Reserva estoque (baixa)
                    app(\App\Services\StockService::class)->reserve($product, (float) $item->quantity, $item->workOrder);
                }
            }
        });

        static::updated(function (self $item) {
            $item->workOrder->recalculateTotal();

            // Detecta mudanças relevantes para estoque
            if ($item->isDirty(['type', 'reference_id', 'quantity'])) {
                /** @var \App\Services\StockService $stockService */
                $stockService = app(\App\Services\StockService::class);
                
                $oldType = $item->getOriginal('type');
                $oldRefId = $item->getOriginal('reference_id');
                $oldQty = (float) $item->getOriginal('quantity');

                $newType = $item->type;
                $newRefId = $item->reference_id;
                $newQty = (float) $item->quantity;

                // 1. Se mudou o PRODUTO (ID ou Tipo) -> Estorna o anterior COMPLETO
                if ($oldType === self::TYPE_PRODUCT && $oldRefId && ($oldRefId != $newRefId || $oldType != $newType)) {
                    $oldProduct = \App\Models\Product::find($oldRefId);
                    if ($oldProduct && $oldProduct->track_stock) {
                        $stockService->returnStock($oldProduct, $oldQty, $item->workOrder);
                    }
                }

                // 2. Se mudou o PRODUTO (ID ou Tipo) -> Reserva o novo COMPLETO
                if ($newType === self::TYPE_PRODUCT && $newRefId && ($oldRefId != $newRefId || $oldType != $newType)) {
                    $newProduct = \App\Models\Product::find($newRefId);
                    if ($newProduct && $newProduct->track_stock) {
                        $stockService->reserve($newProduct, $newQty, $item->workOrder);
                    }
                }

                // 3. Se é o MESMO produto e só mudou a QUANTIDADE -> Ajusta a diferença
                if ($newType === self::TYPE_PRODUCT && $newRefId && $oldRefId == $newRefId && $oldType == $newType) {
                    $product = \App\Models\Product::find($newRefId);
                    if ($product && $product->track_stock) {
                        $diff = $newQty - $oldQty;
                        if ($diff > 0) {
                            $stockService->reserve($product, $diff, $item->workOrder);
                        } elseif ($diff < 0) {
                            $stockService->returnStock($product, abs($diff), $item->workOrder);
                        }
                    }
                }
            }
        });

        static::deleted(function (self $item) {
            $item->workOrder->recalculateTotal();
            if ($item->type === self::TYPE_PRODUCT && $item->reference_id) {
                $product = \App\Models\Product::find($item->reference_id);
                if ($product && $product->track_stock) {
                    // Devolve estoque
                    app(\App\Services\StockService::class)->returnStock($product, (float) $item->quantity, $item->workOrder);
                }
            }
        });
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
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
