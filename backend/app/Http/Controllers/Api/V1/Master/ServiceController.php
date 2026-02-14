<?php

namespace App\Http\Controllers\Api\V1\Master;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Service::with('category:id,name');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if ($categoryId = $request->get('category_id')) {
            $query->where('category_id', $categoryId);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $services = $query->orderBy('name')
            ->paginate($request->get('per_page', 20));

        return response()->json($services);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'nullable|exists:service_categories,id',
            'code' => 'nullable|string|max:50',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'default_price' => 'numeric|min:0',
            'estimated_minutes' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        try {
            $service = DB::transaction(fn () => Service::create($validated));
            return response()->json($service->load('category:id,name'), 201);
        } catch (\Throwable $e) {
            Log::error('Service store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar serviço'], 500);
        }
    }

    public function show(Service $service): JsonResponse
    {
        return response()->json($service->load('category:id,name'));
    }

    public function update(Request $request, Service $service): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'nullable|exists:service_categories,id',
            'code' => 'nullable|string|max:50',
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'default_price' => 'numeric|min:0',
            'estimated_minutes' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        $service->update($validated);
        return response()->json($service->load('category:id,name'));
    }

    public function destroy(Service $service): JsonResponse
    {
        $quotesCount = \App\Models\QuoteItem::where('service_id', $service->id)->count();
        $ordersCount = \App\Models\WorkOrderItem::where('service_id', $service->id)->count();

        if ($quotesCount > 0 || $ordersCount > 0) {
            $parts = [];
            if ($quotesCount > 0) $parts[] = "$quotesCount orçamento(s)";
            if ($ordersCount > 0) $parts[] = "$ordersCount ordem(ns) de serviço";

            return response()->json([
                'message' => "Não é possível excluir este serviço pois ele possui vínculos: " . implode(', ', $parts),
                'dependencies' => [
                    'quotes' => $quotesCount,
                    'work_orders' => $ordersCount,
                ],
            ], 409);
        }

        try {
            DB::transaction(fn () => $service->delete());
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('Service destroy failed', ['id' => $service->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir serviço'], 500);
        }
    }

    // --- Categorias ---
    public function categories(): JsonResponse
    {
        return response()->json(ServiceCategory::orderBy('name')->get());
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate(['name' => 'required|string|max:255']);
        $cat = ServiceCategory::create($validated);
        return response()->json($cat, 201);
    }

    public function updateCategory(Request $request, ServiceCategory $category): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'is_active' => 'boolean',
        ]);
        $category->update($validated);
        return response()->json($category);
    }

    public function destroyCategory(ServiceCategory $category): JsonResponse
    {
        $linkedCount = Service::where('category_id', $category->id)->count();
        if ($linkedCount > 0) {
            return response()->json([
                'message' => "Não é possível excluir. Categoria vinculada a {$linkedCount} serviço(s).",
            ], 409);
        }

        try {
            DB::transaction(fn () => $category->delete());
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('ServiceCategory destroy failed', ['id' => $category->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir categoria'], 500);
        }
    }
}
