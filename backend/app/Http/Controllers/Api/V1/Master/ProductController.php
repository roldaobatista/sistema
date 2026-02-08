<?php

namespace App\Http\Controllers\Api\V1\Master;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::with('category:id,name');

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

        if ($request->boolean('low_stock')) {
            $query->whereColumn('stock_qty', '<=', 'stock_min');
        }

        $products = $query->orderBy('name')
            ->paginate($request->get('per_page', 20));

        return response()->json($products);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'nullable|exists:product_categories,id',
            'code' => 'nullable|string|max:50',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'unit' => 'sometimes|string|max:10',
            'cost_price' => 'numeric|min:0',
            'sell_price' => 'numeric|min:0',
            'stock_qty' => 'numeric|min:0',
            'stock_min' => 'numeric|min:0',
            'is_active' => 'boolean',
        ]);

        $product = Product::create($validated);
        return response()->json($product->load('category:id,name'), 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json($product->load('category:id,name'));
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'nullable|exists:product_categories,id',
            'code' => 'nullable|string|max:50',
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'unit' => 'sometimes|string|max:10',
            'cost_price' => 'numeric|min:0',
            'sell_price' => 'numeric|min:0',
            'stock_qty' => 'numeric|min:0',
            'stock_min' => 'numeric|min:0',
            'is_active' => 'boolean',
        ]);

        $product->update($validated);
        return response()->json($product->load('category:id,name'));
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();
        return response()->json(null, 204);
    }

    // --- Categorias ---
    public function categories(): JsonResponse
    {
        return response()->json(ProductCategory::orderBy('name')->get());
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate(['name' => 'required|string|max:255']);
        $cat = ProductCategory::create($validated);
        return response()->json($cat, 201);
    }

    public function updateCategory(Request $request, ProductCategory $category): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'is_active' => 'boolean',
        ]);
        $category->update($validated);
        return response()->json($category);
    }

    public function destroyCategory(ProductCategory $category): JsonResponse
    {
        $category->delete();
        return response()->json(null, 204);
    }
}
