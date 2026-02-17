<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Notification;
use App\Models\SystemAlert;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class InventoryPwaController extends Controller
{
    /**
     * Armazéns que o usuário logado pode inventariar (técnico: 1; motorista: do(s) veículo(s)).
     */
    public function myWarehouses(Request $request): JsonResponse
    {
        $user = Auth::user();
        $tenantId = (int) ($user->current_tenant_id ?? $user->tenant_id);

        $warehouses = Warehouse::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where(function ($q) use ($user) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('type', Warehouse::TYPE_TECHNICIAN)->where('user_id', $user->id);
                })->orWhere(function ($q2) use ($user) {
                    $q2->where('type', Warehouse::TYPE_VEHICLE)
                        ->whereHas('vehicle', fn ($v) => $v->where('assigned_user_id', $user->id));
                });
            })
            ->with('vehicle:id,plate')
            ->get(['id', 'name', 'code', 'type', 'vehicle_id']);

        return response()->json(['data' => $warehouses]);
    }

    /**
     * Produtos do armazém com quantidade esperada (para o PWA exibir e o usuário informar contagem).
     */
    public function warehouseProducts(Request $request, int $warehouseId): JsonResponse
    {
        $this->authorizeWarehouseForUser($warehouseId);

        $stocks = WarehouseStock::where('warehouse_id', $warehouseId)
            ->with('product:id,name,code,unit')
            ->get();

        $items = $stocks->map(fn ($s) => [
            'product_id' => $s->product_id,
            'product' => $s->product,
            'expected_quantity' => (float) $s->quantity,
        ]);

        return response()->json(['data' => $items]);
    }

    /**
     * Submete contagem do inventário (técnico/motorista). Cria ou atualiza inventário; se houver diferença, gera alerta crítico.
     */
    public function submitCounts(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $validated = $request->validate([
            'warehouse_id' => "required|exists:warehouses,id,tenant_id,{$tenantId}",
            'items' => 'required|array|min:1',
            'items.*.product_id' => "required|exists:products,id,tenant_id,{$tenantId}",
            'items.*.counted_quantity' => 'required|numeric|min:0',
        ]);

        $this->authorizeWarehouseForUser($validated['warehouse_id']);

        $tenantIdInt = (int) (Auth::user()->current_tenant_id ?? Auth::user()->tenant_id);
        $warehouse = Warehouse::findOrFail($validated['warehouse_id']);

        return DB::transaction(function () use ($validated, $tenantIdInt, $warehouse) {
            $inventory = Inventory::where('tenant_id', $tenantIdInt)
                ->where('warehouse_id', $validated['warehouse_id'])
                ->whereIn('status', [Inventory::STATUS_OPEN, Inventory::STATUS_PROCESSING])
                ->first();

            if (!$inventory) {
                $inventory = Inventory::create([
                    'tenant_id' => $tenantIdInt,
                    'warehouse_id' => $validated['warehouse_id'],
                    'reference' => 'PWA - ' . $warehouse->name . ' - ' . now()->format('d/m/Y H:i'),
                    'status' => Inventory::STATUS_OPEN,
                    'created_by' => Auth::id(),
                ]);
                $stocks = WarehouseStock::where('warehouse_id', $validated['warehouse_id'])->get();
                foreach ($stocks as $stock) {
                    $inventory->items()->create([
                        'product_id' => $stock->product_id,
                        'batch_id' => $stock->batch_id,
                        'expected_quantity' => $stock->quantity,
                    ]);
                }
            }

            $hasDiscrepancy = false;
            $discrepancyDetail = [];

            foreach ($validated['items'] as $row) {
                $item = $inventory->items()->where('product_id', $row['product_id'])->first();
                if (!$item) {
                    $item = $inventory->items()->create([
                        'product_id' => $row['product_id'],
                        'batch_id' => null,
                        'expected_quantity' => WarehouseStock::where('warehouse_id', $validated['warehouse_id'])
                            ->where('product_id', $row['product_id'])->value('quantity') ?? 0,
                    ]);
                }
                $expected = (float) $item->expected_quantity;
                $counted = (float) ($row['counted_quantity'] ?? 0);
                $item->update(['counted_quantity' => $counted]);
                if (abs($counted - $expected) > 0.0001) {
                    $hasDiscrepancy = true;
                    $discrepancyDetail[] = "Produto #{$item->product_id}: esperado {$expected}, contado {$counted}";
                }
            }

            if ($hasDiscrepancy) {
                $this->createInventoryDiscrepancyAlert($inventory, $warehouse, $discrepancyDetail);
            }

            return response()->json([
                'message' => $hasDiscrepancy
                    ? 'Contagem recebida. Foi detectada diferença em relação ao esperado; o responsável do estoque foi notificado.'
                    : 'Contagem recebida.',
                'inventory_id' => $inventory->id,
                'has_discrepancy' => $hasDiscrepancy,
                'data' => $inventory->fresh('items.product'),
            ], 201);
        });
    }

    protected function authorizeWarehouseForUser(int $warehouseId): void
    {
        $user = Auth::user();
        $w = Warehouse::find($warehouseId);
        if (!$w) {
            abort(404);
        }
        if ($w->type === Warehouse::TYPE_TECHNICIAN && (int) $w->user_id === (int) $user->id) {
            return;
        }
        if ($w->type === Warehouse::TYPE_VEHICLE && $w->vehicle_id && $w->vehicle && (int) $w->vehicle->assigned_user_id === (int) $user->id) {
            return;
        }
        abort(403, 'Você não pode inventariar este armazém.');
    }

    protected function createInventoryDiscrepancyAlert(Inventory $inventory, Warehouse $warehouse, array $detail): void
    {
        $tenantId = $inventory->tenant_id;
        $title = 'Diferença no inventário - ' . $warehouse->name;
        $message = implode('; ', array_slice($detail, 0, 5));
        if (count($detail) > 5) {
            $message .= ' (e mais ' . (count($detail) - 5) . ')';
        }

        SystemAlert::create([
            'tenant_id' => $tenantId,
            'alert_type' => 'inventory_discrepancy_critical',
            'severity' => 'critical',
            'title' => $title,
            'message' => $message,
            'status' => 'active',
            'alertable_type' => Inventory::class,
            'alertable_id' => $inventory->id,
        ]);

        $estoquistas = \App\Models\User::where('tenant_id', $tenantId)->role('estoquista')->pluck('id');
        $link = '/estoque/inventarios/' . $inventory->id;
        foreach ($estoquistas as $uid) {
            Notification::notify($tenantId, $uid, 'inventory_discrepancy_critical', $title, [
                'message' => $message,
                'link' => $link,
                'data' => ['inventory_id' => $inventory->id],
            ]);
        }
    }
}
