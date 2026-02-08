<?php

namespace App\Http\Controllers\Api\V1\Os;

use App\Http\Controllers\Controller;
use App\Models\RecurringContract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecurringContractController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = RecurringContract::with([
            'customer:id,name',
            'equipment:id,type,brand,model',
            'assignee:id,name',
            'items',
        ]);

        if ($request->boolean('active_only', false)) {
            $query->where('is_active', true);
        }

        if ($search = $request->get('search')) {
            $query->where('name', 'like', "%{$search}%");
        }

        $contracts = $query->orderBy('next_run_date')->paginate($request->get('per_page', 20));
        return response()->json($contracts);
    }

    public function show(RecurringContract $recurringContract): JsonResponse
    {
        $recurringContract->load([
            'customer:id,name,phone',
            'equipment:id,type,brand,model,serial_number',
            'assignee:id,name',
            'creator:id,name',
            'items',
        ]);

        return response()->json($recurringContract);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'equipment_id' => 'nullable|exists:equipment,id',
            'assigned_to' => 'nullable|exists:users,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'frequency' => 'required|in:weekly,biweekly,monthly,bimonthly,quarterly,semiannual,annual',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after:start_date',
            'priority' => 'nullable|string|in:low,normal,high,urgent',
            'items' => 'nullable|array',
            'items.*.type' => 'required_with:items|in:product,service',
            'items.*.description' => 'required_with:items|string',
            'items.*.quantity' => 'required_with:items|numeric|min:0.01',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
        ]);

        $validated['tenant_id'] = app('current_tenant_id');
        $validated['created_by'] = $request->user()->id;
        $validated['next_run_date'] = $validated['start_date'];

        $items = $validated['items'] ?? [];
        unset($validated['items']);

        $contract = RecurringContract::create($validated);

        foreach ($items as $item) {
            $contract->items()->create($item);
        }

        return response()->json($contract->load('items'), 201);
    }

    public function update(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'sometimes|exists:customers,id',
            'equipment_id' => 'nullable|exists:equipment,id',
            'assigned_to' => 'nullable|exists:users,id',
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'frequency' => 'sometimes|in:weekly,biweekly,monthly,bimonthly,quarterly,semiannual,annual',
            'end_date' => 'nullable|date',
            'priority' => 'nullable|string|in:low,normal,high,urgent',
            'is_active' => 'sometimes|boolean',
            'items' => 'nullable|array',
            'items.*.type' => 'required_with:items|in:product,service',
            'items.*.description' => 'required_with:items|string',
            'items.*.quantity' => 'required_with:items|numeric|min:0.01',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
        ]);

        $items = $validated['items'] ?? null;
        unset($validated['items']);

        $recurringContract->update($validated);

        if ($items !== null) {
            $recurringContract->items()->delete();
            foreach ($items as $item) {
                $recurringContract->items()->create($item);
            }
        }

        return response()->json($recurringContract->load('items'));
    }

    public function destroy(RecurringContract $recurringContract): JsonResponse
    {
        $recurringContract->delete();
        return response()->json(null, 204);
    }

    /** Gerar OS manualmente a partir do contrato */
    public function generate(RecurringContract $recurringContract): JsonResponse
    {
        if (!$recurringContract->is_active) {
            return response()->json(['message' => 'Contrato inativo'], 422);
        }

        $wo = $recurringContract->generateWorkOrder();

        return response()->json([
            'message' => 'OS gerada com sucesso',
            'work_order' => $wo->load('customer:id,name'),
        ]);
    }
}
