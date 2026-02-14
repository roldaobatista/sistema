<?php

namespace App\Http\Controllers\Api\V1\Os;

use App\Http\Controllers\Controller;
use App\Models\RecurringContract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class RecurringContractController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

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
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipment_id' => ['nullable', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'assigned_to' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
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

        $validated['tenant_id'] = $tenantId;
        $validated['created_by'] = $request->user()->id;
        $validated['next_run_date'] = $validated['start_date'];

        $items = $validated['items'] ?? [];
        unset($validated['items']);

        try {
            $contract = DB::transaction(function () use ($validated, $items) {
                $contract = RecurringContract::create($validated);
                foreach ($items as $item) {
                    $contract->items()->create($item);
                }
                return $contract;
            });

            return response()->json($contract->load('items'), 201);
        } catch (\Throwable $e) {
            Log::error('RecurringContract store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar contrato recorrente'], 500);
        }
    }

    public function update(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'customer_id' => ['sometimes', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipment_id' => ['nullable', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'assigned_to' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
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

        try {
            $result = DB::transaction(function () use ($recurringContract, $validated, $items) {
                $recurringContract->update($validated);

                if ($items !== null) {
                    $recurringContract->items()->delete();
                    foreach ($items as $item) {
                        $recurringContract->items()->create($item);
                    }
                }

                return $recurringContract;
            });

            return response()->json($result->load('items'));
        } catch (\Throwable $e) {
            Log::error('RecurringContract update failed', ['id' => $recurringContract->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar contrato'], 500);
        }
    }

    public function destroy(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        if ((int) $recurringContract->tenant_id !== $this->tenantId($request)) {
            return response()->json(['message' => 'Contrato não encontrado'], 404);
        }

        try {
            DB::transaction(function () use ($recurringContract) {
                $recurringContract->items()->delete();
                $recurringContract->delete();
            });
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('RecurringContract destroy failed', ['id' => $recurringContract->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir contrato'], 500);
        }
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
