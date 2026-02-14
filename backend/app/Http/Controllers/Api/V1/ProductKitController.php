<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductKit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductKitController extends Controller
{
    public function index(Product $product): JsonResponse
    {
        if (!$product->is_kit) {
            return response()->json(['message' => 'Este produto não é um kit'], 422);
        }

        return response()->json([
            'data' => $product->kitItems()->with('child')->get()
        ]);
    }

    public function store(Request $request, Product $product): JsonResponse
    {
        if (!$product->is_kit) {
            return response()->json(['message' => 'Este produto não é um kit'], 422);
        }

        $tenantId = app('current_tenant_id');
        $validated = $request->validate([
            'child_id' => "required|exists:products,id,tenant_id,{$tenantId}",
            'quantity' => 'required|numeric|min:0.0001',
        ]);

        if ($validated['child_id'] == $product->id) {
            return response()->json(['message' => 'Um kit não pode conter a si mesmo'], 422);
        }

        $kitItem = $product->kitItems()->updateOrCreate(
            ['child_id' => $validated['child_id']],
            ['quantity' => $validated['quantity']]
        );

        return response()->json([
            'message' => 'Componente adicionado ao kit',
            'data' => $kitItem->load('child')
        ]);
    }

    public function destroy(Product $product, int $childId): JsonResponse
    {
        $product->kitItems()->where('child_id', $childId)->delete();
        return response()->json(['message' => 'Componente removido do kit']);
    }
}
