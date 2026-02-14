<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class PaymentMethodController extends Controller
{
    private function currentTenantId(Request $request): int
    {
        $user = $request->user();

        return app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        return response()->json(
            PaymentMethod::where('tenant_id', $tenantId)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'code' => [
                'required', 'string', 'max:30',
                Rule::unique('payment_methods')->where('tenant_id', $tenantId),
            ],
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        try {
            $method = DB::transaction(function () use ($validated, $tenantId) {
                return PaymentMethod::create([
                    ...$validated,
                    'tenant_id' => $tenantId,
                ]);
            });

            return response()->json($method, 201);
        } catch (\Throwable $e) {
            Log::error('PaymentMethod store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar forma de pagamento'], 500);
        }
    }

    public function update(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        if ((int) $paymentMethod->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Forma de pagamento não encontrada'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'code' => [
                'sometimes', 'string', 'max:30',
                Rule::unique('payment_methods')
                    ->where('tenant_id', $paymentMethod->tenant_id)
                    ->ignore($paymentMethod->id),
            ],
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        try {
            $paymentMethod->update($validated);
            return response()->json($paymentMethod);
        } catch (\Throwable $e) {
            Log::error('PaymentMethod update failed', ['id' => $paymentMethod->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar forma de pagamento'], 500);
        }
    }

    public function destroy(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $tenantId = $this->currentTenantId($request);

        if ((int) $paymentMethod->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Forma de pagamento não encontrada'], 404);
        }

        try {
            DB::transaction(fn () => $paymentMethod->delete());
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('PaymentMethod destroy failed', ['id' => $paymentMethod->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir forma de pagamento'], 500);
        }
    }
}
