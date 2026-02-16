<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\Notification;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockTransferService
{
    public function createTransfer(
        int $fromWarehouseId,
        int $toWarehouseId,
        array $items,
        ?string $notes = null,
        ?int $createdBy = null
    ): StockTransfer {
        $from = Warehouse::findOrFail($fromWarehouseId);
        $to = Warehouse::findOrFail($toWarehouseId);
        $tenantId = $from->tenant_id;
        $createdBy = $createdBy ?? auth()->id();

        $this->validateWarehouses($from, $to, $tenantId);
        $this->validateItemsAndBalance($fromWarehouseId, $items, $tenantId);

        return DB::transaction(function () use ($from, $to, $items, $notes, $createdBy, $tenantId) {
            $toUserId = $this->resolveToUserId($to, $from);
            $requiresAcceptance = $toUserId !== null || ($from->isVehicle() && $to->isCentral());
            $status = $requiresAcceptance
                ? StockTransfer::STATUS_PENDING_ACCEPTANCE
                : StockTransfer::STATUS_ACCEPTED;

            $transfer = StockTransfer::create([
                'tenant_id' => $tenantId,
                'from_warehouse_id' => $from->id,
                'to_warehouse_id' => $to->id,
                'status' => $status,
                'notes' => $notes,
                'to_user_id' => $toUserId,
                'created_by' => $createdBy,
            ]);

            foreach ($items as $row) {
                StockTransferItem::create([
                    'stock_transfer_id' => $transfer->id,
                    'product_id' => $row['product_id'],
                    'quantity' => $row['quantity'],
                ]);
            }

            if ($status === StockTransfer::STATUS_ACCEPTED) {
                $this->applyTransfer($transfer);
            } else {
                $this->notifyTransferPending($transfer, $from, $to);
            }

            return $transfer->load(['items.product', 'fromWarehouse', 'toWarehouse', 'toUser']);
        });
    }

    public function acceptTransfer(StockTransfer $transfer, int $acceptedBy): StockTransfer
    {
        if ($transfer->status !== StockTransfer::STATUS_PENDING_ACCEPTANCE) {
            throw ValidationException::withMessages(['transfer' => ['Esta transferência não está pendente de aceite.']]);
        }

        $this->authorizeAccept($transfer, $acceptedBy);
        $this->validateItemsAndBalance($transfer->from_warehouse_id, $transfer->items->toArray(), $transfer->tenant_id);

        return DB::transaction(function () use ($transfer, $acceptedBy) {
            $transfer->update([
                'status' => StockTransfer::STATUS_ACCEPTED,
                'accepted_at' => now(),
                'accepted_by' => $acceptedBy,
                'rejected_at' => null,
                'rejected_by' => null,
                'rejection_reason' => null,
            ]);
            $this->applyTransfer($transfer);
            return $transfer->fresh(['items.product', 'fromWarehouse', 'toWarehouse']);
        });
    }

    public function rejectTransfer(StockTransfer $transfer, int $rejectedBy, ?string $reason = null): StockTransfer
    {
        if ($transfer->status !== StockTransfer::STATUS_PENDING_ACCEPTANCE) {
            throw ValidationException::withMessages(['transfer' => ['Esta transferência não está pendente de aceite.']]);
        }

        $this->authorizeReject($transfer, $rejectedBy);

        $transfer->update([
            'status' => StockTransfer::STATUS_REJECTED,
            'rejected_at' => now(),
            'rejected_by' => $rejectedBy,
            'rejection_reason' => $reason,
        ]);

        return $transfer->fresh(['items.product', 'fromWarehouse', 'toWarehouse']);
    }

    protected function applyTransfer(StockTransfer $transfer): void
    {
        $fromId = $transfer->from_warehouse_id;
        $toId = $transfer->to_warehouse_id;
        $userId = $transfer->accepted_by ?? $transfer->created_by;

        foreach ($transfer->items as $item) {
            $qty = (float) $item->quantity;
            $product = Product::find($item->product_id);
            if (!$product) {
                continue;
            }

            $source = WarehouseStock::where('warehouse_id', $fromId)
                ->where('product_id', $product->id)
                ->first();
            $balance = $source ? (float) $source->quantity : 0;
            if ($balance < $qty) {
                throw ValidationException::withMessages([
                    'items' => ["Saldo insuficiente para o produto {$product->name} no armazém de origem."],
                ]);
            }

            StockMovement::create([
                'tenant_id' => $transfer->tenant_id,
                'product_id' => $product->id,
                'warehouse_id' => $fromId,
                'target_warehouse_id' => $toId,
                'batch_id' => null,
                'type' => StockMovementType::Transfer,
                'quantity' => $qty,
                'unit_cost' => $product->cost_price ?? 0,
                'reference' => "Transferência #{$transfer->id}",
                'notes' => $transfer->notes,
                'created_by' => $userId,
            ]);
        }
    }

    protected function resolveToUserId(Warehouse $to, Warehouse $from): ?int
    {
        if ($to->isTechnician() && $to->user_id) {
            return $to->user_id;
        }
        if ($to->isVehicle() && $to->vehicle_id && $to->vehicle) {
            return $to->vehicle->assigned_user_id;
        }
        if ($from->isVehicle() && $to->isCentral()) {
            return null;
        }
        return null;
    }

    protected function validateWarehouses(Warehouse $from, Warehouse $to, int $tenantId): void
    {
        if ($from->id === $to->id) {
            throw ValidationException::withMessages(['to_warehouse_id' => ['Origem e destino devem ser diferentes.']]);
        }
        if ($from->tenant_id !== $tenantId || $to->tenant_id !== $tenantId) {
            throw ValidationException::withMessages(['warehouses' => ['Armazéns devem pertencer ao tenant.']]);
        }
    }

    protected function validateItemsAndBalance(int $fromWarehouseId, array $items, int $tenantId): void
    {
        foreach ($items as $row) {
            $productId = $row['product_id'];
            $qty = (float) ($row['quantity'] ?? 0);
            if ($qty <= 0) {
                throw ValidationException::withMessages(['items' => ['Quantidade deve ser maior que zero.']]);
            }
            $stock = WarehouseStock::where('warehouse_id', $fromWarehouseId)
                ->where('product_id', $productId)
                ->first();
            $balance = $stock ? (float) $stock->quantity : 0;
            if ($balance < $qty) {
                $product = Product::find($productId);
                $name = $product ? $product->name : "ID {$productId}";
                throw ValidationException::withMessages([
                    'items' => ["Saldo insuficiente para {$name} no armazém de origem (disponível: {$balance})."],
                ]);
            }
        }
    }

    protected function authorizeAccept(StockTransfer $transfer, int $userId): void
    {
        if ($transfer->to_user_id === $userId) {
            return;
        }
        $user = \App\Models\User::find($userId);
        if ($user && $user->hasRole('estoquista')) {
            $from = $transfer->fromWarehouse;
            if ($from && $from->isVehicle()) {
                return;
            }
        }
        throw ValidationException::withMessages(['transfer' => ['Você não pode aceitar esta transferência.']]);
    }

    protected function authorizeReject(StockTransfer $transfer, int $userId): void
    {
        $this->authorizeAccept($transfer, $userId);
    }

    protected function notifyTransferPending(StockTransfer $transfer, Warehouse $from, Warehouse $to): void
    {
        if ($transfer->to_user_id) {
            Notification::notify(
                $transfer->tenant_id,
                $transfer->to_user_id,
                'stock_transfer_pending_acceptance',
                "Transferência de estoque pendente de seu aceite (#{$transfer->id})",
                [
                    'message' => "De: {$from->name} → Para: {$to->name}",
                    'link' => "/estoque/transferencias/{$transfer->id}",
                    'data' => ['stock_transfer_id' => $transfer->id],
                ]
            );
        }

        if ($from->isVehicle() && $to->isTechnician()) {
            $this->notifyEstoquistas($transfer, $from, $to);
        }
        if ($from->isVehicle() && $to->isCentral()) {
            $this->notifyEstoquistas($transfer, $from, $to);
        }
    }

    protected function notifyEstoquistas(StockTransfer $transfer, Warehouse $from, Warehouse $to): void
    {
        $users = \App\Models\User::where('tenant_id', $transfer->tenant_id)
            ->role('estoquista')
            ->pluck('id');
        foreach ($users as $uid) {
            Notification::notify(
                $transfer->tenant_id,
                $uid,
                'stock_transfer_vehicle_to_technician',
                "Transferência de estoque: {$from->name} → {$to->name} (#{$transfer->id})",
                [
                    'message' => 'Transferência criada; acompanhe em Transferências.',
                    'link' => "/estoque/transferencias/{$transfer->id}",
                    'data' => ['stock_transfer_id' => $transfer->id],
                ]
            );
        }
    }
}
