<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\WorkOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class StockService
{
    public function reserve(Product $product, float $qty, WorkOrder $workOrder): StockMovement
    {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Reserve,
            quantity: $qty,
            workOrder: $workOrder,
            reference: "OS-{$workOrder->business_number}",
        );
    }

    public function deduct(Product $product, float $qty, WorkOrder $workOrder): StockMovement
    {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Exit,
            quantity: $qty,
            workOrder: $workOrder,
            reference: "OS-{$workOrder->business_number} (faturamento)",
        );
    }

    public function returnStock(Product $product, float $qty, WorkOrder $workOrder): StockMovement
    {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Return,
            quantity: $qty,
            workOrder: $workOrder,
            reference: "OS-{$workOrder->business_number} (cancelamento)",
        );
    }

    public function manualEntry(Product $product, float $qty, float $unitCost, ?string $notes, User $user): StockMovement
    {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Entry,
            quantity: $qty,
            unitCost: $unitCost,
            notes: $notes,
            user: $user,
            reference: 'Entrada manual',
        );
    }

    public function manualAdjustment(Product $product, float $qty, ?string $notes, User $user): StockMovement
    {
        return $this->createMovement(
            product: $product,
            type: StockMovementType::Adjustment,
            quantity: $qty,
            notes: $notes,
            user: $user,
            reference: 'Ajuste de inventário',
        );
    }

    private function createMovement(
        Product $product,
        StockMovementType $type,
        float $quantity,
        ?WorkOrder $workOrder = null,
        ?string $reference = null,
        float $unitCost = 0,
        ?string $notes = null,
        ?User $user = null,
    ): StockMovement {
        return DB::transaction(function () use ($product, $type, $quantity, $workOrder, $reference, $unitCost, $notes, $user) {
            return StockMovement::create([
                'tenant_id' => $product->tenant_id,
                'product_id' => $product->id,
                'work_order_id' => $workOrder?->id,
                'type' => $type,
                'quantity' => abs($quantity),
                'unit_cost' => $unitCost,
                'reference' => $reference,
                'notes' => $notes,
                'created_by' => $user?->id ?? auth()->id(),
            ]);
        });
    }
}
