<?php

namespace App\Http\Controllers\Api\V1\Operational;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Models\WorkOrder;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ExpressWorkOrderController extends Controller
{
    use ResolvesCurrentTenant;

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $validated = $request->validate([
            'customer_name' => 'required_without:customer_id|string|max:255',
            'customer_id' => ['nullable', \Illuminate\Validation\Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'description' => 'required|string',
            'priority' => 'required|in:low,normal,high,urgent',
        ]);

        try {
            return DB::transaction(function () use ($validated, $tenantId, $request) {
                $customerId = $validated['customer_id'] ?? null;
                if (!$customerId) {
                    $customer = Customer::create([
                        'tenant_id' => $tenantId,
                        'name' => $validated['customer_name'],
                        'status' => 'active',
                        'type' => 'individual',
                    ]);
                    $customerId = $customer->id;
                }

                $workOrder = WorkOrder::create([
                    'tenant_id' => $tenantId,
                    'customer_id' => $customerId,
                    'number' => WorkOrder::nextNumber($tenantId),
                    'description' => $validated['description'],
                    'priority' => $validated['priority'],
                    'status' => WorkOrder::STATUS_OPEN,
                    'origin_type' => 'manual',
                    'assigned_to' => $request->user()->id,
                    'created_by' => $request->user()->id,
                ]);

                $workOrder->statusHistory()->create([
                    'tenant_id' => $tenantId,
                    'user_id' => $request->user()->id,
                    'from_status' => null,
                    'to_status' => WorkOrder::STATUS_OPEN,
                    'notes' => 'OS Express criada',
                ]);

                // Broadcast para dashboard/kanban em real-time
                event(new \App\Events\WorkOrderStatusChanged($workOrder));

                return response()->json([
                    'message' => 'OS Express criada com sucesso',
                    'data' => $workOrder->load(['customer:id,name', 'assignee:id,name'])
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('OS Express failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar OS Express'], 500);
        }
    }
}
