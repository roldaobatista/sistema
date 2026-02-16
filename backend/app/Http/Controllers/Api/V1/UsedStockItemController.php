<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\UsedStockItem;
use App\Models\Warehouse;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UsedStockItemController extends Controller
{
    public function __construct(
        private readonly StockService $stockService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) (auth()->user()->current_tenant_id ?? auth()->user()->tenant_id);

        $query = UsedStockItem::with(['workOrder:id,os_number,number', 'product:id,name,code', 'technicianWarehouse.user:id,name'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('work_order_id')) {
            $query->where('work_order_id', $request->work_order_id);
        }
        if ($request->filled('technician_warehouse_id')) {
            $query->where('technician_warehouse_id', $request->technician_warehouse_id);
        }

        $items = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 20));
        return response()->json($items);
    }

    /**
     * Técnico informa: devolvi ou cliente ficou (pendente de confirmação do estoquista).
     */
    public function report(Request $request, UsedStockItem $usedStockItem): JsonResponse
    {
        $this->authorizeTenant($usedStockItem);
        if ($usedStockItem->status !== UsedStockItem::STATUS_PENDING_RETURN) {
            return response()->json(['message' => 'Item não está pendente de informação.'], 422);
        }

        $validated = $request->validate([
            'disposition_type' => 'required|in:return,write_off',
            'disposition_notes' => 'nullable|string|max:500',
        ]);

        $usedStockItem->update([
            'status' => UsedStockItem::STATUS_PENDING_CONFIRMATION,
            'reported_by' => auth()->id(),
            'reported_at' => now(),
            'disposition_type' => $validated['disposition_type'],
            'disposition_notes' => $validated['disposition_notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Informação registrada. Aguardando confirmação do estoquista.',
            'used_stock_item' => $usedStockItem->fresh(['workOrder', 'product']),
        ]);
    }

    /**
     * Estoquista confirma devolução: gera entrada no estoque central.
     */
    public function confirmReturn(Request $request, UsedStockItem $usedStockItem): JsonResponse
    {
        $this->authorizeTenant($usedStockItem);
        if ($usedStockItem->status !== UsedStockItem::STATUS_PENDING_CONFIRMATION || $usedStockItem->disposition_type !== 'return') {
            return response()->json(['message' => 'Item não está pendente de confirmação de devolução.'], 422);
        }

        $tenantId = $usedStockItem->tenant_id;
        $central = Warehouse::where('tenant_id', $tenantId)->where('type', Warehouse::TYPE_FIXED)->whereNull('user_id')->whereNull('vehicle_id')->first();
        if (!$central) {
            return response()->json(['message' => 'Armazém central não configurado.'], 422);
        }

        DB::transaction(function () use ($usedStockItem, $central) {
            $usedStockItem->update([
                'status' => UsedStockItem::STATUS_RETURNED,
                'confirmed_by' => auth()->id(),
                'confirmed_at' => now(),
            ]);
            $product = $usedStockItem->product;
            if ($product) {
                $this->stockService->manualEntry($product, (float) $usedStockItem->quantity, $central->id, null, null, 0, 'Devolução peça usada (OS)');
            }
        });

        return response()->json([
            'message' => 'Devolução confirmada e entrada no estoque central registrada.',
            'used_stock_item' => $usedStockItem->fresh(['workOrder', 'product']),
        ]);
    }

    /**
     * Estoquista confirma baixa sem devolução (cliente ficou, descarte, etc.).
     */
    public function confirmWriteOff(Request $request, UsedStockItem $usedStockItem): JsonResponse
    {
        $this->authorizeTenant($usedStockItem);
        if ($usedStockItem->status !== UsedStockItem::STATUS_PENDING_CONFIRMATION || $usedStockItem->disposition_type !== 'write_off') {
            return response()->json(['message' => 'Item não está pendente de confirmação de baixa.'], 422);
        }

        $usedStockItem->update([
            'status' => UsedStockItem::STATUS_WRITTEN_OFF_NO_RETURN,
            'confirmed_by' => auth()->id(),
            'confirmed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Baixa sem devolução registrada.',
            'used_stock_item' => $usedStockItem->fresh(['workOrder', 'product']),
        ]);
    }

    protected function authorizeTenant(UsedStockItem $item): void
    {
        $tenantId = (int) (auth()->user()->current_tenant_id ?? auth()->user()->tenant_id);
        if ($item->tenant_id !== $tenantId) {
            abort(404);
        }
    }
}
