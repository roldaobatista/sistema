<?php

namespace App\Http\Controllers\Api\V1\Operational;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Models\Customer;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ExpressWorkOrderController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'customer_name' => 'required_without:customer_id|string|max:255',
            'customer_id' => 'nullable|exists:customers,id',
            'service_id' => 'nullable|exists:services,id',
            'description' => 'required|string',
            'priority' => 'required|in:low,medium,high,critical',
        ]);

        try {
            return DB::transaction(function () use ($validated, $tenantId, $request) {
                // 1. Get or Create Customer
                $customerId = $validated['customer_id'] ?? null;
                if (!$customerId) {
                    $customer = Customer::create([
                        'tenant_id' => $tenantId,
                        'name' => $validated['customer_name'],
                        'status' => 'active',
                        'type' => 'individual', // Default
                    ]);
                    $customerId = $customer->id;
                }

                // 2. Create Work Order
                $workOrder = WorkOrder::create([
                    'tenant_id' => $tenantId,
                    'customer_id' => $customerId,
                    'service_id' => $validated['service_id'] ?? null,
                    'description' => $validated['description'],
                    'priority' => $validated['priority'],
                    'status' => 'open',
                    'origin' => 'express',
                    'technician_id' => $request->user()->id, // Auto-assign to self
                ]);

                return response()->json([
                    'message' => 'OS Express criada com sucesso',
                    'data' => $workOrder->load(['customer:id,name', 'service:id,name'])
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('OS Express failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar OS Express'], 500);
        }
    }
}
