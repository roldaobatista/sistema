<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EquipmentModel;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EquipmentModelController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = EquipmentModel::query()
            ->withCount('products');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('brand', 'like', "%{$search}%");
            });
        }
        if ($category = $request->get('category')) {
            $query->where('category', $category);
        }

        $list = $query->orderBy('name')->paginate($request->get('per_page', 25));
        return response()->json($list);
    }

    public function show(Request $request, EquipmentModel $equipmentModel): JsonResponse
    {
        $this->checkTenant($request, $equipmentModel);
        $equipmentModel->load('products:id,name,code');
        return response()->json(['equipment_model' => $equipmentModel]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'brand' => 'nullable|string|max:100',
            'category' => 'nullable|string|max:40',
        ]);
        $validated['tenant_id'] = $this->tenantId($request);
        $model = EquipmentModel::create($validated);
        return response()->json(['equipment_model' => $model], 201);
    }

    public function update(Request $request, EquipmentModel $equipmentModel): JsonResponse
    {
        $this->checkTenant($request, $equipmentModel);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'brand' => 'nullable|string|max:100',
            'category' => 'nullable|string|max:40',
        ]);
        $equipmentModel->update($validated);
        return response()->json(['equipment_model' => $equipmentModel->fresh()]);
    }

    public function destroy(Request $request, EquipmentModel $equipmentModel): JsonResponse
    {
        $this->checkTenant($request, $equipmentModel);
        $count = $equipmentModel->equipments()->count();
        if ($count > 0) {
            return response()->json([
                'message' => "Não é possível excluir: {$count} equipamento(s) vinculado(s) a este modelo.",
            ], 422);
        }
        $equipmentModel->delete();
        return response()->json(['message' => 'Modelo excluído.']);
    }

    public function syncProducts(Request $request, EquipmentModel $equipmentModel): JsonResponse
    {
        $this->checkTenant($request, $equipmentModel);
        $tenantId = $this->tenantId($request);
        $validated = $request->validate([
            'product_ids' => 'required|array',
            'product_ids.*' => 'integer|exists:products,id',
        ]);
        $productIds = collect($validated['product_ids'])->unique()->values()->all();
        $allowed = Product::where('tenant_id', $tenantId)->whereIn('id', $productIds)->pluck('id')->all();
        $equipmentModel->products()->sync($allowed);
        $equipmentModel->load('products:id,name,code');
        return response()->json(['equipment_model' => $equipmentModel]);
    }

    private function checkTenant(Request $request, EquipmentModel $model): void
    {
        $tenantId = $this->tenantId($request);
        if ((int) $model->tenant_id !== $tenantId) {
            abort(404);
        }
    }
}
