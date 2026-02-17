<?php

namespace App\Http\Controllers\Api\V1\Master;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        if ($location = $request->get('storage_location')) {
            $query->where('storage_location', 'like', "%{$location}%");
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
            'manufacturer_code' => 'nullable|string|max:100',
            'storage_location' => 'nullable|string|max:100',
        ]);

        try {
            $product = DB::transaction(fn () => Product::create($validated));
            return response()->json($product->load('category:id,name'), 201);
        } catch (\Throwable $e) {
            Log::error('Product store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar produto'], 500);
        }
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json($product->load(['category:id,name', 'equipmentModels:id,name,brand,category']));
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
            'manufacturer_code' => 'nullable|string|max:100',
            'storage_location' => 'nullable|string|max:100',
        ]);

        try {
            DB::transaction(fn () => $product->update($validated));
            return response()->json($product->load('category:id,name'));
        } catch (\Throwable $e) {
            Log::error('Product update failed', ['id' => $product->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar produto'], 500);
        }
    }

    public function destroy(Product $product): JsonResponse
    {
        $quotesCount = \App\Models\QuoteItem::where('product_id', $product->id)->count();
        $ordersCount = \App\Models\WorkOrderItem::where('product_id', $product->id)->count();
        // Assuming StockMovement model exists and has product_id
        $stocksCount = \App\Models\StockMovement::where('product_id', $product->id)->count();

        if ($quotesCount > 0 || $ordersCount > 0 || $stocksCount > 0) {
            $parts = [];
            if ($quotesCount > 0) $parts[] = "$quotesCount orçamento(s)";
            if ($ordersCount > 0) $parts[] = "$ordersCount ordem(ns) de serviço";
            if ($stocksCount > 0) $parts[] = "$stocksCount movimentação(ões) de estoque";

            return response()->json([
                'message' => "Não é possível excluir este produto pois ele possui vínculos: " . implode(', ', $parts),
                'dependencies' => [
                    'quotes' => $quotesCount,
                    'work_orders' => $ordersCount,
                    'stock_movements' => $stocksCount,
                ],
            ], 409);
        }

        try {
            DB::transaction(fn () => $product->delete());
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('Product destroy failed', ['id' => $product->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir produto'], 500);
        }
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
        $linkedCount = Product::where('category_id', $category->id)->count();
        if ($linkedCount > 0) {
            return response()->json([
                'message' => "Não é possível excluir. Categoria vinculada a {$linkedCount} produto(s).",
            ], 409);
        }

        try {
            DB::transaction(fn () => $category->delete());
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('ProductCategory destroy failed', ['id' => $category->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir categoria'], 500);
        }
    }
}
