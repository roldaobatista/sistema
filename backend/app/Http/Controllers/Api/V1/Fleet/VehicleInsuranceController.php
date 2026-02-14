<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Fleet\VehicleInsurance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class VehicleInsuranceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = VehicleInsurance::where('tenant_id', $request->user()->tenant_id)
            ->with('vehicle:id,plate,model,brand');

        if ($request->filled('fleet_vehicle_id')) {
            $query->where('fleet_vehicle_id', $request->fleet_vehicle_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->latest('end_date')->paginate($request->per_page ?? 15));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fleet_vehicle_id' => 'required|exists:fleet_vehicles,id',
            'insurer' => 'required|string|max:150',
            'policy_number' => 'nullable|string|max:80',
            'coverage_type' => ['required', Rule::in(['comprehensive', 'third_party', 'total_loss'])],
            'premium_value' => 'required|numeric|min:0',
            'deductible_value' => 'nullable|numeric|min:0',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'broker_name' => 'nullable|string|max:150',
            'broker_phone' => 'nullable|string|max:30',
            'status' => ['sometimes', Rule::in(['active', 'expired', 'cancelled', 'pending'])],
            'notes' => 'nullable|string',
        ]);

        $validated['tenant_id'] = $request->user()->tenant_id;

        try {
            DB::beginTransaction();
            $insurance = VehicleInsurance::create($validated);
            DB::commit();

            return response()->json(['message' => 'Seguro registrado com sucesso', 'data' => $insurance->load('vehicle')], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar seguro', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno ao registrar seguro'], 500);
        }
    }

    public function show(VehicleInsurance $insurance): JsonResponse
    {
        if ($insurance->tenant_id != auth()->user()->tenant_id) abort(403);
        return response()->json($insurance->load('vehicle'));
    }

    public function update(Request $request, VehicleInsurance $insurance): JsonResponse
    {
        if ($insurance->tenant_id != $request->user()->tenant_id) abort(403);

        $validated = $request->validate([
            'insurer' => 'sometimes|string|max:150',
            'policy_number' => 'nullable|string|max:80',
            'coverage_type' => ['sometimes', Rule::in(['comprehensive', 'third_party', 'total_loss'])],
            'premium_value' => 'sometimes|numeric|min:0',
            'deductible_value' => 'nullable|numeric|min:0',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after:start_date',
            'broker_name' => 'nullable|string|max:150',
            'broker_phone' => 'nullable|string|max:30',
            'status' => ['sometimes', Rule::in(['active', 'expired', 'cancelled', 'pending'])],
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $insurance->update($validated);
            DB::commit();
            return response()->json(['message' => 'Seguro atualizado', 'data' => $insurance->fresh('vehicle')]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao atualizar seguro', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno'], 500);
        }
    }

    public function destroy(VehicleInsurance $insurance): JsonResponse
    {
        if ($insurance->tenant_id != auth()->user()->tenant_id) abort(403);
        $insurance->delete();
        return response()->json(null, 204);
    }

    public function alerts(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $expiringSoon = VehicleInsurance::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->where('end_date', '<=', now()->addDays(30))
            ->where('end_date', '>=', now())
            ->with('vehicle:id,plate,model')
            ->orderBy('end_date')
            ->get();

        $expired = VehicleInsurance::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->where('end_date', '<', now())
            ->with('vehicle:id,plate,model')
            ->orderBy('end_date')
            ->get();

        return response()->json([
            'expiring_soon' => $expiringSoon,
            'expired' => $expired,
        ]);
    }
}
