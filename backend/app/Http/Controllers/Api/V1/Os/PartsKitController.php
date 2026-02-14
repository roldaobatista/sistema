<?php

namespace App\Http\Controllers\Api\V1\Os;

use App\Http\Controllers\Controller;
use App\Models\PartsKit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PartsKitController extends Controller
{
    private function currentTenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    /**
     * GET /parts-kits — list all kits with items count.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PartsKit::withCount('items')
            ->where('tenant_id', $this->currentTenantId());

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('name', 'LIKE', "%{$search}%");
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $perPage = min((int) $request->input('per_page', 20), 100);

        return response()->json($query->orderBy('name')->paginate($perPage));
    }

    /**
     * GET /parts-kits/{id} — single kit with items.
     */
    public function show(int $id): JsonResponse
    {
        $kit = PartsKit::with('items')
            ->where('tenant_id', $this->currentTenantId())
            ->findOrFail($id);

        $total = $kit->items->sum(fn($item) => $item->quantity * $item->unit_price);

        return response()->json([
            'data' => $kit,
            'total' => number_format($total, 2, '.', ''),
        ]);
    }

    /**
     * POST /parts-kits — create a kit with items.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'boolean',
            'items' => 'required|array|min:1',
            'items.*.type' => 'required|in:product,service',
            'items.*.reference_id' => 'nullable|integer',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $kit = PartsKit::create([
                'tenant_id' => $this->currentTenantId(),
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'is_active' => $validated['is_active'] ?? true,
            ]);

            foreach ($validated['items'] as $item) {
                $kit->items()->create($item);
            }

            DB::commit();

            return response()->json([
                'message' => 'Kit criado com sucesso',
                'data' => $kit->load('items'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('PartsKit store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar kit'], 500);
        }
    }

    /**
     * PUT /parts-kits/{id} — update kit and replace items.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $kit = PartsKit::where('tenant_id', $this->currentTenantId())
            ->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'boolean',
            'items' => 'required|array|min:1',
            'items.*.type' => 'required|in:product,service',
            'items.*.reference_id' => 'nullable|integer',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $kit->update([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'is_active' => $validated['is_active'] ?? $kit->is_active,
            ]);

            // Replace all items
            $kit->items()->delete();
            foreach ($validated['items'] as $item) {
                $kit->items()->create($item);
            }

            DB::commit();

            return response()->json([
                'message' => 'Kit atualizado com sucesso',
                'data' => $kit->fresh()->load('items'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('PartsKit update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar kit'], 500);
        }
    }

    /**
     * DELETE /parts-kits/{id} — soft delete a kit.
     */
    public function destroy(int $id): JsonResponse
    {
        $kit = PartsKit::where('tenant_id', $this->currentTenantId())
            ->findOrFail($id);

        $kit->delete();

        return response()->json(['message' => 'Kit removido com sucesso']);
    }

    /**
     * POST /work-orders/{work_order}/apply-kit/{parts_kit}
     * Applies all items from a kit to a work order.
     */
    public function applyToWorkOrder(int $workOrderId, int $partsKitId): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $kit = PartsKit::with('items')
            ->where('tenant_id', $tenantId)
            ->findOrFail($partsKitId);

        $workOrder = \App\Models\WorkOrder::where('tenant_id', $tenantId)
            ->findOrFail($workOrderId);

        DB::beginTransaction();
        try {
            foreach ($kit->items as $kitItem) {
                $workOrder->items()->create([
                    'tenant_id' => $tenantId,
                    'type' => $kitItem->type,
                    'reference_id' => $kitItem->reference_id,
                    'description' => $kitItem->description,
                    'quantity' => $kitItem->quantity,
                    'unit_price' => $kitItem->unit_price,
                    'discount' => 0,
                    'total' => bcmul($kitItem->quantity, $kitItem->unit_price, 2),
                ]);
            }

            // Recalculate WO total
            $workOrder->total = $workOrder->items()->sum('total');
            $workOrder->save();

            DB::commit();

            return response()->json([
                'message' => "Kit \"{$kit->name}\" aplicado com sucesso ({$kit->items->count()} itens)",
                'data' => $workOrder->fresh()->load('items'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('PartsKit apply failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao aplicar kit'], 500);
        }
    }
}
