<?php
namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Fleet\VehicleAccident;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class VehicleAccidentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $query = VehicleAccident::where('tenant_id', $request->user()->tenant_id)
                ->with(['vehicle:id,plate,model', 'driver:id,name']);

            if ($request->filled('fleet_vehicle_id')) {
                $query->where('fleet_vehicle_id', $request->fleet_vehicle_id);
            }

            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            return response()->json($query->latest('occurrence_date')->paginate($request->per_page ?? 15));
        } catch (\Exception $e) {
            Log::error('VehicleAccident index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar acidentes'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'fleet_vehicle_id' => 'required|exists:fleet_vehicles,id',
                'occurrence_date' => 'required|date',
                'location' => 'nullable|string',
                'description' => 'required|string',
                'third_party_involved' => 'boolean',
                'third_party_info' => 'nullable|string',
                'police_report_number' => 'nullable|string',
                'photos' => 'nullable|array',
                'estimated_cost' => 'nullable|numeric',
                'status' => ['required', Rule::in(['investigating', 'insurance_claim', 'repaired', 'loss'])],
            ]);

            $validated['tenant_id'] = $request->user()->tenant_id;
            $validated['driver_id'] = $request->user()->id;

            $accident = VehicleAccident::create($validated);

            DB::commit();
            return response()->json(['message' => 'Acidente registrado', 'data' => $accident], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('VehicleAccident store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar acidente'], 500);
        }
    }

    public function show(VehicleAccident $accident): JsonResponse
    {
        try {
            if ($accident->tenant_id != auth()->user()->tenant_id) abort(403);
            return response()->json($accident->load(['vehicle', 'driver']));
        } catch (\Exception $e) {
            Log::error('VehicleAccident show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar acidente'], 500);
        }
    }

    public function update(Request $request, VehicleAccident $accident): JsonResponse
    {
        try {
            DB::beginTransaction();

            if ($accident->tenant_id != $request->user()->tenant_id) abort(403);

            $validated = $request->validate([
                'occurrence_date' => 'sometimes|date',
                'location' => 'nullable|string',
                'description' => 'sometimes|string',
                'third_party_involved' => 'boolean',
                'third_party_info' => 'nullable|string',
                'police_report_number' => 'nullable|string',
                'photos' => 'nullable|array',
                'estimated_cost' => 'nullable|numeric',
                'status' => ['sometimes', Rule::in(['investigating', 'insurance_claim', 'repaired', 'loss'])],
            ]);

            $accident->update($validated);

            DB::commit();
            return response()->json(['message' => 'Acidente atualizado', 'data' => $accident]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('VehicleAccident update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar acidente'], 500);
        }
    }

    public function destroy(VehicleAccident $accident): JsonResponse
    {
        try {
            if ($accident->tenant_id != auth()->user()->tenant_id) abort(403);
            $accident->delete();
            return response()->json(['message' => 'Acidente excluído']);
        } catch (\Exception $e) {
            Log::error('VehicleAccident destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir acidente'], 500);
        }
    }
}
