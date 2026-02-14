<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\FuelingLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class FuelingLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $query = FuelingLog::where('tenant_id', $tenantId)
            ->with(['user:id,name', 'workOrder:id,os_number', 'approvedByUser:id,name']);

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('date', '<=', $request->date_to);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('vehicle_plate', 'like', "%{$s}%")
                  ->orWhere('gas_station', 'like', "%{$s}%");
            });
        }

        $logs = $query->orderByDesc('date')->paginate($request->input('per_page', 25));

        return response()->json($logs);
    }

    public function show(FuelingLog $fuelingLog): JsonResponse
    {
        $fuelingLog->load(['user:id,name', 'workOrder:id,os_number', 'approvedByUser:id,name']);
        return response()->json($fuelingLog);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where('tenant_id', $tenantId)],
            'vehicle_plate' => 'required|string|max:20',
            'odometer_km' => 'required|numeric|min:0',
            'gas_station' => 'nullable|string|max:255',
            'fuel_type' => ['required', Rule::in(FuelingLog::FUEL_TYPES)],
            'liters' => 'required|numeric|min:0.01',
            'price_per_liter' => 'required|numeric|min:0.01',
            'total_amount' => 'required|numeric|min:0.01',
            'date' => 'required|date',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
        $log = DB::transaction(function () use ($validated, $tenantId, $request) {
            return FuelingLog::create([
                ...$validated,
                'tenant_id' => $tenantId,
                'user_id' => $request->user()->id,
                'status' => FuelingLog::STATUS_PENDING,
            ]);
        });

        return response()->json($log->load(['user:id,name', 'workOrder:id,os_number']), 201);
        } catch (\Exception $e) {
            Log::error('FuelingLog store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar abastecimento'], 500);
        }
    }

    public function update(Request $request, FuelingLog $fuelingLog): JsonResponse
    {
        if ($fuelingLog->status !== FuelingLog::STATUS_PENDING) {
            return response()->json(['message' => 'Apenas registros pendentes podem ser editados'], 422);
        }

        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where('tenant_id', $tenantId)],
            'vehicle_plate' => 'sometimes|string|max:20',
            'odometer_km' => 'sometimes|numeric|min:0',
            'gas_station' => 'nullable|string|max:255',
            'fuel_type' => ['sometimes', Rule::in(FuelingLog::FUEL_TYPES)],
            'liters' => 'sometimes|numeric|min:0.01',
            'price_per_liter' => 'sometimes|numeric|min:0.01',
            'total_amount' => 'sometimes|numeric|min:0.01',
            'date' => 'sometimes|date',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $fuelingLog->update($validated);
            return response()->json($fuelingLog->fresh()->load(['user:id,name', 'workOrder:id,os_number']));
        } catch (\Exception $e) {
            Log::error('FuelingLog update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar abastecimento'], 500);
        }
    }

    public function approve(Request $request, FuelingLog $fuelingLog): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['required', Rule::in(['approve', 'reject'])],
        ]);

        if ($fuelingLog->status !== FuelingLog::STATUS_PENDING) {
            return response()->json(['message' => 'Apenas registros pendentes podem ser aprovados/rejeitados'], 422);
        }

        try {
            DB::beginTransaction();

            $fuelingLog->update([
                'status' => $validated['action'] === 'approve' ? FuelingLog::STATUS_APPROVED : FuelingLog::STATUS_REJECTED,
                'approved_by' => $request->user()->id,
            ]);

            DB::commit();
            return response()->json($fuelingLog->fresh()->load(['user:id,name', 'approvedByUser:id,name']));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('FuelingLog approve failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao aprovar/rejeitar abastecimento'], 500);
        }
    }

    public function destroy(Request $request, FuelingLog $fuelingLog): JsonResponse
{
    $tenantId = $fuelingLog->tenant_id;
    $currentTenantId = $request->user()->tenant_id;

    if ((int) $tenantId !== (int) $currentTenantId) {
        return response()->json(['message' => 'Acesso negado'], 403);
    }

    if ($fuelingLog->status !== FuelingLog::STATUS_PENDING) {
        return response()->json(['message' => 'Apenas registros pendentes podem ser excluídos'], 422);
    }

    try {
        DB::transaction(fn () => $fuelingLog->delete());
        return response()->json(['message' => 'Registro excluído']);
    } catch (\Exception $e) {
        Log::error('FuelingLog destroy failed', ['id' => $fuelingLog->id, 'error' => $e->getMessage()]);
        return response()->json(['message' => 'Erro ao excluir registro'], 500);
    }
}
}
