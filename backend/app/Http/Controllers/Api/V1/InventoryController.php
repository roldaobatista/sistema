<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Notification;
use App\Models\SystemAlert;
use App\Models\WarehouseStock;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class InventoryController extends Controller
{
    public function __construct(protected StockService $stockService) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $query = Inventory::where('tenant_id', $tenantId)
            ->with(['warehouse', 'creator:id,name']);

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $results = $query->latest()->paginate($request->integer('per_page', 20));

        // Para segurança, removemos contagens detalhadas da listagem se não for admin
        // (Opcional, mas aqui vamos manter a listagem limpa)
        
        return response()->json($results);
    }

    /** Inicia uma nova sessão de inventário */
    public function store(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $validated = $request->validate([
            'warehouse_id' => "required|exists:warehouses,id,tenant_id,{$tenantId}",
            'reference' => 'nullable|string|max:100',
            'category_id' => 'nullable|integer',
        ]);

        // Evitar múltiplos inventários abertos para o mesmo depósito
        $exists = Inventory::where('tenant_id', $tenantId)
            ->where('warehouse_id', $validated['warehouse_id'])
            ->where('status', Inventory::STATUS_OPEN)
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'Já existe um inventário aberto para este depósito.'], 422);
        }

        try {
            return DB::transaction(function () use ($validated, $tenantId) {
                $inventory = Inventory::create([
                    'tenant_id' => $tenantId,
                    'warehouse_id' => $validated['warehouse_id'],
                    'reference' => $validated['reference'],
                    'status' => Inventory::STATUS_OPEN,
                    'created_by' => Auth::id(),
                ]);

                $stocks = WarehouseStock::where('warehouse_id', $validated['warehouse_id'])
                    ->whereHas('product', fn ($q) => $q->where('tenant_id', $tenantId))
                    ->get();

                foreach ($stocks as $stock) {
                    $inventory->items()->create([
                        'product_id' => $stock->product_id,
                        'batch_id' => $stock->batch_id,
                        'product_serial_id' => $stock->product_serial_id,
                        'expected_quantity' => $stock->quantity,
                    ]);
                }

                return response()->json([
                    'message' => 'Inventário iniciado com sucesso',
                    'data' => $inventory->load('items.product')
                ], 201);
            });
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Inventory store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao iniciar inventário'], 500);
        }
    }

    public function show(Inventory $inventory): JsonResponse
    {
        $this->authorizeTenant($inventory);
        $inventory->load(['warehouse', 'items.product', 'items.batch', 'items.productSerial', 'creator:id,name']);

        // Blind Audit: Se o inventário estiver aberto, ocultamos a quantidade esperada
        if ($inventory->status === Inventory::STATUS_OPEN) {
            $inventory->items->each(function ($item) {
                $item->makeHidden(['expected_quantity', 'discrepancy']);
            });
        }

        return response()->json($inventory);
    }

    /** Registra a contagem de um item (Blind Count) */
    public function updateItem(Request $request, Inventory $inventory, InventoryItem $item): JsonResponse
    {
        $this->authorizeTenant($inventory);
        
        if ($inventory->status !== Inventory::STATUS_OPEN) {
            return response()->json(['message' => 'Este inventário já foi processado ou cancelado'], 422);
        }

        $validated = $request->validate([
            'counted_quantity' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:255',
        ]);

        $item->update([
            'counted_quantity' => $validated['counted_quantity'],
            'notes' => $validated['notes'] ?? $item->notes,
        ]);

        return response()->json([
            'message' => 'Contagem registrada',
            'data' => $item
        ]);
    }

    /** Finaliza o inventário e processa os ajustes automáticos */
    public function complete(Inventory $inventory): JsonResponse
    {
        $this->authorizeTenant($inventory);

        if ($inventory->status !== Inventory::STATUS_OPEN) {
            return response()->json(['message' => 'Status inválido para finalização'], 422);
        }

        // Verifica se todos os itens foram contados
        if ($inventory->items()->whereNull('counted_quantity')->exists()) {
            return response()->json(['message' => 'Existem itens sem contagem registrada'], 422);
        }

        try {
            return DB::transaction(function () use ($inventory) {
                $discrepancyDetails = [];
                foreach ($inventory->items as $item) {
                    $discrepancy = $item->discrepancy;

                    if ($discrepancy != 0) {
                        $adjustQty = $discrepancy;
                        $this->stockService->manualAdjustment(
                            product: $item->product,
                            qty: $adjustQty,
                            warehouseId: $inventory->warehouse_id,
                            batchId: $item->batch_id,
                            serialId: $item->product_serial_id ?? null,
                            notes: "Ajuste automático via Inventário #{$inventory->id} ({$inventory->reference})",
                            user: Auth::user()
                        );

                        $item->update(['adjustment_quantity' => $discrepancy]);
                        $discrepancyDetails[] = $item->product->name . ': esperado ' . $item->expected_quantity . ', contado ' . $item->counted_quantity;
                    }
                }

                $inventory->update([
                    'status' => Inventory::STATUS_COMPLETED,
                    'completed_at' => now()
                ]);

                if (count($discrepancyDetails) > 0) {
                    $warehouse = $inventory->warehouse;
                    $title = 'Diferença no inventário - ' . ($warehouse ? $warehouse->name : '#' . $inventory->warehouse_id);
                    SystemAlert::create([
                        'tenant_id' => $inventory->tenant_id,
                        'alert_type' => 'inventory_discrepancy_critical',
                        'severity' => 'critical',
                        'title' => $title,
                        'message' => implode('; ', array_slice($discrepancyDetails, 0, 5)),
                        'status' => 'active',
                        'alertable_type' => Inventory::class,
                        'alertable_id' => $inventory->id,
                    ]);
                    $estoquistas = \App\Models\User::where('tenant_id', $inventory->tenant_id)->role('estoquista')->pluck('id');
                    foreach ($estoquistas as $uid) {
                        Notification::notify($inventory->tenant_id, $uid, 'inventory_discrepancy_critical', $title, [
                            'message' => 'Inventário finalizado com diferenças. Revise em Estoque > Inventários.',
                            'link' => '/estoque/inventarios/' . $inventory->id,
                            'data' => ['inventory_id' => $inventory->id],
                        ]);
                    }
                }

                return response()->json([
                    'message' => 'Inventário finalizado e ajustes aplicados',
                    'data' => $inventory->load('items')
                ]);
            });
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Inventory completion failed', [
                'inventory_id' => $inventory->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Erro ao finalizar inventário. Tente novamente.'], 500);
        }
    }

    public function cancel(Inventory $inventory): JsonResponse
    {
        $this->authorizeTenant($inventory);
        
        if ($inventory->status === Inventory::STATUS_COMPLETED) {
            return response()->json(['message' => 'Não é possível cancelar um inventário já finalizado'], 422);
        }

        $inventory->update(['status' => Inventory::STATUS_CANCELLED]);

        return response()->json(['message' => 'Inventário cancelado']);
    }

    private function authorizeTenant(Inventory $inventory)
    {
        if ($inventory->tenant_id !== (int) app('current_tenant_id')) {
            abort(403);
        }
    }
}
