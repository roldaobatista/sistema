<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentMethodController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            PaymentMethod::orderBy('sort_order')->orderBy('name')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'code' => [
                'required', 'string', 'max:30',
                Rule::unique('payment_methods')->where('tenant_id', $tenantId),
            ],
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        return response()->json(PaymentMethod::create($validated), 201);
    }

    public function update(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
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

        $paymentMethod->update($validated);
        return response()->json($paymentMethod);
    }

    public function destroy(PaymentMethod $paymentMethod): JsonResponse
    {
        $paymentMethod->delete();
        return response()->json(null, 204);
    }
}
