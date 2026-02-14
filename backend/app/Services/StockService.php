<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\WorkOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class StockService
{
    public function reserve(Product $product, float $qty, WorkOrder $workOrder, ?int $warehouseId = null): StockMovement
    {
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
            $movement = StockMovement::create([
                'tenant_id' => $product->tenant_id,
                'product_id' => $product->id,
                'warehouse_id' => $warehouseId,
                'target_warehouse_id' => $targetWarehouseId,
                'batch_id' => $batchId,
                'product_serial_id' => $serialId,
                'work_order_id' => $workOrder?->id,
                'type' => $type->value,
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'reference' => $reference,
                'notes' => $notes,
                'user_id' => $user?->id ?? (Auth::check() ? Auth::id() : null),
                'created_by' => $user?->id ?? (Auth::check() ? Auth::id() : null),
            ]);

            // Chamada ao método de aplicação automática definido no modelo refatorado
            $movement->applyToProductStock();

            // Explosão de Kit (apenas para Saídas e Ajustes Negativos)
            if ($product->is_kit && in_array($type, [StockMovementType::Exit, StockMovementType::Adjustment]) && $quantity > 0) {
                $this->explodeKit($product, $quantity, $warehouseId, $type, $notes, $user);
            }

            return $movement;
        });
    }

    private function explodeKit(Product $kit, float $quantity, int $warehouseId, StockMovementType $type, ?string $notes = null, ?User $user = null): void
    {
        $items = $kit->kitItems()->get();
        
        foreach ($items as $item) {
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
        $tenantId = app('current_tenant_id');

        $query = StockMovement::where('tenant_id', $tenantId)
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->with(['batch', 'serial', 'user:id,name'])
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc');

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $movements = $query->get();
        $runningBalance = 0;

        // Se houver saldo anterior (Kardex retroativo), precisaríamos buscá-lo aqui
        // Mas para simplificação do MVP Calibrium, estamos pegando o histórico completo do período inicial

        return $movements->map(function ($movement) use (&$runningBalance) {
            $type = StockMovementType::from($movement->type);
            $qty = (float) $movement->quantity;
            $sign = $type->affectsStock();
            
            // Especial para Ajuste: o sinal está no qty (positivo = entrada, negativo = saída)
            if ($type === StockMovementType::Adjustment) {
                $runningBalance += $qty;
            } else {
                $runningBalance += ($qty * $sign);
            }

            return [
                'id' => $movement->id,
                'date' => $movement->created_at->toDateTimeString(),
                'type' => $type->value,
                'type_label' => $type->label(),
                'quantity' => $qty,
                'batch' => $movement->batch?->code,
                'serial' => $movement->serial?->serial_number,
                'notes' => $movement->notes,
                'user' => $movement->user?->name,
                'balance' => $runningBalance,
            ];
        });
    }
}
