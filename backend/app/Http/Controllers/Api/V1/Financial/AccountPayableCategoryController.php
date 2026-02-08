<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountPayableCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountPayableCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = AccountPayableCategory::where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'color' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:255',
        ]);

        $category = AccountPayableCategory::create([
            ...$validated,
            'tenant_id' => $request->user()->tenant_id,
        ]);

        return response()->json($category, 201);
    }

    public function update(Request $request, AccountPayableCategory $category): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'color' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
        ]);

        $category->update($validated);

        return response()->json($category);
    }

    public function destroy(AccountPayableCategory $category): JsonResponse
    {
        if ($category->accountsPayable()->exists()) {
            return response()->json([
                'message' => 'Não é possível excluir categoria com contas a pagar vinculadas',
            ], 409);
        }

        $category->delete();
        return response()->json(null, 204);
    }
}
