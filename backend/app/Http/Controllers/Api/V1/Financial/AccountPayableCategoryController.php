<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountPayableCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountPayableCategoryController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $categories = AccountPayableCategory::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', \Illuminate\Validation\Rule::unique('account_payable_categories')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'color' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:255',
        ]);

        $category = AccountPayableCategory::create([
            ...$validated,
            'tenant_id' => $tenantId,
            'is_active' => true,
        ]);

        return response()->json($category, 201);
    }

    public function update(Request $request, AccountPayableCategory $category): JsonResponse
    {
        if ($category->tenant_id !== $this->tenantId($request)) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:100', \Illuminate\Validation\Rule::unique('account_payable_categories')->ignore($category->id)->where(fn ($q) => $q->where('tenant_id', $category->tenant_id))],
            'color' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
        ]);

        $category->update($validated);

        return response()->json($category);
    }

    public function destroy(Request $request, AccountPayableCategory $category): JsonResponse
    {
        if ($category->tenant_id !== $this->tenantId($request)) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        if ($category->accountsPayable()->exists()) {
            return response()->json([
                'message' => 'Não é possível excluir categoria com contas a pagar vinculadas',
            ], 422); // Changed to 422 to match other modules
        }

        $category->delete();
        return response()->json(null, 204);
    }
}
