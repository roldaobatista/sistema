<?php

namespace App\Http\Controllers\Api\V1\Master;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $service = Service::create($validated);
        return response()->json($service->load('category:id,name'), 201);
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
        $service->delete();
        return response()->json(null, 204);
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
        $category->delete();
        return response()->json(null, 204);
    }
}
