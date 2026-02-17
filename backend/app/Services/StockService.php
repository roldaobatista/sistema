<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Warehouse;
use App\Models\WorkOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class StockService
{
    /**
     * Resolve warehouse for WO: technician warehouse if assigned_to, else central.
     */
    public function resolveWarehouseIdForWorkOrder(WorkOrder $workOrder): ?int
    {
        $tenantId = $workOrder->tenant_id;
        if ($workOrder->assigned_to) {
            $w = Warehouse::where('tenant_id', $tenantId)
                ->where('type', Warehouse::TYPE_TECHNICIAN)
                ->where('user_id', $workOrder->assigned_to)
                ->first();
            if ($w) {
                return (int) $w->id;
            }
        }
        $central = Warehouse::where('tenant_id', $tenantId)
            ->where('type', Warehouse::TYPE_FIXED)
            ->whereNull('user_id')
            ->whereNull('vehicle_id')
            ->first();
        return $central ? (int) $central->id : null;
    }

    public function reserve(Product $product, float $qty, WorkOrder $workOrder, ?int $warehouseId = null): StockMovement
    {
        $warehouseId = $warehouseId ?? $this->resolveWarehouseIdForWorkOrder($workOrder);
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Reserve,
            quantity: $qty,
            warehouseId: $warehouseId,
            workOrder: $workOrder,
            reference: "OS-{$workOrder->number}",
        );
    }

    public function deduct(Product $product, float $qty, WorkOrder $workOrder, ?int $warehouseId = null): StockMovement
    {
        $warehouseId = $warehouseId ?? $this->resolveWarehouseIdForWorkOrder($workOrder);
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Exit,
            quantity: $qty,
            warehouseId: $warehouseId,
            workOrder: $workOrder,
            reference: "OS-{$workOrder->number} (faturamento)",
        );
    }

    public function returnStock(Product $product, float $qty, WorkOrder $workOrder, ?int $warehouseId = null): StockMovement
    {
        $warehouseId = $warehouseId ?? $this->resolveWarehouseIdForWorkOrder($workOrder);
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Return,
            quantity: $qty,
            warehouseId: $warehouseId,
            workOrder: $workOrder,
            reference: "OS-{$workOrder->number} (cancelamento)",
        );
    }

    public function manualEntry(
        Product $product,
        float $qty,
        int $warehouseId,
        ?int $batchId = null,
        ?int $serialId = null,
        float $unitCost = 0,
        ?string $notes = null,
        ?User $user = null
    ): StockMovement {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Entry,
            quantity: $qty,
            warehouseId: $warehouseId,
            batchId: $batchId,
            serialId: $serialId,
            unitCost: $unitCost ?: $product->cost_price,
            notes: $notes,
            user: $user,
            reference: 'Entrada manual',
        );
    }

    public function manualExit(
        Product $product,
        float $qty,
        int $warehouseId,
        ?int $batchId = null,
        ?int $serialId = null,
        ?string $notes = null,
        ?User $user = null
    ): StockMovement {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Exit,
            quantity: $qty,
            warehouseId: $warehouseId,
            batchId: $batchId,
            serialId: $serialId,
            notes: $notes,
            user: $user,
            reference: 'Saída manual',
        );
    }

    public function manualReturn(
        Product $product,
        float $qty,
        int $warehouseId,
        ?int $batchId = null,
        ?int $serialId = null,
        ?string $notes = null,
        ?User $user = null
    ): StockMovement {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Return,
            quantity: $qty,
            warehouseId: $warehouseId,
            batchId: $batchId,
            serialId: $serialId,
            notes: $notes,
            user: $user,
            reference: 'Devolução manual',
        );
    }

    public function manualReserve(
        Product $product,
        float $qty,
        int $warehouseId,
        ?int $batchId = null,
        ?int $serialId = null,
        ?string $notes = null,
        ?User $user = null
    ): StockMovement {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Reserve,
            quantity: $qty,
            warehouseId: $warehouseId,
            batchId: $batchId,
            serialId: $serialId,
            notes: $notes,
            user: $user,
            reference: 'Reserva manual',
        );
    }

    public function manualAdjustment(
        Product $product,
        float $qty,
        int $warehouseId,
        ?int $batchId = null,
        ?int $serialId = null,
        ?string $notes = null,
        ?User $user = null
    ): StockMovement {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Adjustment,
            quantity: $qty,
            warehouseId: $warehouseId,
            batchId: $batchId,
            serialId: $serialId,
            notes: $notes,
            user: $user,
            reference: 'Ajuste de inventário',
        );
    }

    public function transfer(
        Product $product,
        float $qty,
        int $fromWarehouseId,
        int $toWarehouseId,
        ?int $batchId = null,
        ?int $serialId = null,
        ?string $notes = null,
        ?User $user = null
    ): StockMovement {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Transfer,
            quantity: $qty,
            warehouseId: $fromWarehouseId,
            targetWarehouseId: $toWarehouseId,
            batchId: $batchId,
            serialId: $serialId,
            notes: $notes,
            user: $user,
            reference: 'Transferência entre armazéns',
        );
    }

    private function createMovement(
        Product $product,
        StockMovementType $type,
        float $quantity,
        ?int $warehouseId = null,
        ?int $targetWarehouseId = null,
        ?int $batchId = null,
        ?int $serialId = null,
        ?WorkOrder $workOrder = null,
        ?string $reference = null,
        float $unitCost = 0,
        ?string $notes = null,
        ?User $user = null,
    ): StockMovement {
        return DB::transaction(function () use (
            $product, $type, $quantity, $warehouseId, $targetWarehouseId,
            $batchId, $serialId, $workOrder, $reference, $unitCost, $notes, $user
        ) {
            $normalizedQuantity = $type === StockMovementType::Adjustment
                ? $quantity
                : abs($quantity);

            $movement = StockMovement::create([
                'tenant_id' => $product->tenant_id,
                'product_id' => $product->id,
                'warehouse_id' => $warehouseId,
                'target_warehouse_id' => $targetWarehouseId,
                'batch_id' => $batchId,
                'product_serial_id' => $serialId,
                'work_order_id' => $workOrder?->id,
                'type' => $type->value,
                'quantity' => $normalizedQuantity,
                'unit_cost' => $unitCost,
                'reference' => $reference,
                'notes' => $notes,
                'created_by' => $user?->id ?? (Auth::check() ? Auth::id() : null),
            ]);

            if ($product->is_kit && $type === StockMovementType::Exit) {
                $this->explodeKit($product, $quantity, $warehouseId, StockMovementType::Exit, $notes, $user);
            } elseif ($product->is_kit && $type === StockMovementType::Entry) {
                $this->explodeKit($product, $quantity, $warehouseId, StockMovementType::Entry, $notes, $user);
            } elseif ($product->is_kit && $type === StockMovementType::Adjustment) {
                $childType = $quantity > 0 ? StockMovementType::Entry : StockMovementType::Exit;
                $this->explodeKit($product, abs($quantity), $warehouseId, $childType, $notes, $user);
            }

            return $movement;
        });
    }


    private function explodeKit(Product $kit, float $quantity, int $warehouseId, StockMovementType $type, ?string $notes = null, ?User $user = null, int $depth = 0): void
    {
        if ($depth > 5) {
            Log::warning('Kit explosion exceeded max depth', ['kit_id' => $kit->id, 'depth' => $depth]);
            return;
        }

        $items = $kit->kitItems()->with('child')->get();

        foreach ($items as $item) {
            if (!$item->child) {
                continue;
            }

            $childQty = $item->quantity * $quantity;

            $this->createMovement(
                product: $item->child,
                type: $type,
                quantity: $childQty,
                warehouseId: $warehouseId,
                notes: "Automático: Explosão do Kit {$kit->name}. " . ($notes ?? ''),
                user: $user,
                reference: "Kit: {$kit->id}",
            );
        }
    }

    /**
     * Gera o Kardex (histórico de movimentação) de um produto com saldo progressivo
     */
    public function getKardex(int $productId, int $warehouseId, ?string $dateFrom = null, ?string $dateTo = null)
    {
        $tenantId = app()->bound('current_tenant_id') ? (int) app('current_tenant_id') : null;

        if (!$tenantId) {
            return collect();
        }

        $runningBalance = 0;

        if ($dateFrom) {
            $priorBalance = StockMovement::where('tenant_id', $tenantId)
                ->where('product_id', $productId)
                ->where(function ($q) use ($warehouseId) {
                    $q->where('warehouse_id', $warehouseId)
                      ->orWhere(function ($q2) use ($warehouseId) {
                          $q2->where('type', 'transfer')
                             ->where('target_warehouse_id', $warehouseId);
                      });
                })
                ->where('created_at', '<', $dateFrom)
                ->selectRaw("
                    SUM(CASE
                        WHEN type = 'adjustment' THEN quantity
                        WHEN type IN ('entry','return') THEN quantity
                        WHEN type IN ('exit','reserve') THEN -quantity
                        WHEN type = 'transfer' AND warehouse_id = ? THEN -quantity
                        WHEN type = 'transfer' AND target_warehouse_id = ? THEN quantity
                        ELSE 0
                    END) as balance
                ", [$warehouseId, $warehouseId])
                ->value('balance');

            $runningBalance = (float) ($priorBalance ?? 0);
        }

        $query = StockMovement::where('tenant_id', $tenantId)
            ->where('product_id', $productId)
            ->where(function ($q) use ($warehouseId) {
                $q->where('warehouse_id', $warehouseId)
                  ->orWhere(function ($q2) use ($warehouseId) {
                      $q2->where('type', 'transfer')
                         ->where('target_warehouse_id', $warehouseId);
                  });
            })
            ->with(['batch', 'productSerial', 'user:id,name'])
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc');

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $movements = $query->get();

        return $movements->map(function ($movement) use (&$runningBalance, $warehouseId) {
            $type = $movement->type;
            $qty = (float) $movement->quantity;

            if ($type === StockMovementType::Adjustment) {
                $runningBalance += $qty;
            } elseif ($type === StockMovementType::Transfer) {
                // Se o armazém é origem → saída; se é destino → entrada
                if ((int) $movement->warehouse_id === $warehouseId) {
                    $runningBalance -= $qty;
                } else {
                    $runningBalance += $qty;
                }
            } else {
                $sign = $type->affectsStock();
                $runningBalance += ($qty * $sign);
            }

            return [
                'id' => $movement->id,
                'date' => $movement->created_at->toDateTimeString(),
                'type' => $type->value,
                'type_label' => $type->label(),
                'quantity' => $qty,
                'batch' => $movement->batch?->code,
                'serial' => $movement->productSerial?->serial_number,
                'notes' => $movement->notes,
                'user' => $movement->user?->name,
                'balance' => round($runningBalance, 2),
            ];
        });
    }
}
