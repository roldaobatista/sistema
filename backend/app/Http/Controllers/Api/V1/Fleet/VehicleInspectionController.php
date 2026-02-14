<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\VehicleInspection;
use App\Models\FleetVehicle;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class VehicleInspectionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $query = VehicleInspection::where('tenant_id', $request->user()->tenant_id)
                ->with(['vehicle:id,plate,model', 'inspector:id,name']);

            if ($request->filled('fleet_vehicle_id')) {
                $query->where('fleet_vehicle_id', $request->fleet_vehicle_id);
            }

            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            return response()->json($query->latest('inspection_date')->paginate($request->per_page ?? 15));
        } catch (\Exception $e) {
            Log::error('VehicleInspection index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar inspeções'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'fleet_vehicle_id' => 'required|exists:fleet_vehicles,id',
                'inspection_date' => 'required|date',
                'odometer_km' => 'required|integer',
                'checklist_data' => 'required|array',
                'status' => ['required', Rule::in(['ok', 'issues_found', 'critical'])],
                'observations' => 'nullable|string',
            ]);

            $validated['tenant_id'] = $request->user()->tenant_id;
            $validated['inspector_id'] = $request->user()->id;

            $inspection = VehicleInspection::create($validated);

            FleetVehicle::find($validated['fleet_vehicle_id'])?->update([
                'odometer_km' => $validated['odometer_km']
            ]);

            DB::commit();
            return response()->json(['message' => 'Inspeção registrada', 'data' => $inspection], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('VehicleInspection store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar inspeção'], 500);
        }
    }

    public function show(VehicleInspection $inspection): JsonResponse
    {
        try {
            if ($inspection->tenant_id != auth()->user()->tenant_id) abort(403);
            return response()->json($inspection->load(['vehicle', 'inspector']));
        } catch (\Exception $e) {
            Log::error('VehicleInspection show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar inspeção'], 500);
        }
    }

    public function update(Request $request, VehicleInspection $inspection): JsonResponse
    {
        try {
            DB::beginTransaction();

            if ($inspection->tenant_id != $request->user()->tenant_id) abort(403);

            $validated = $request->validate([
                'inspection_date' => 'sometimes|date',
                'odometer_km' => 'sometimes|integer',
                'checklist_data' => 'sometimes|array',
                'status' => ['sometimes', Rule::in(['ok', 'issues_found', 'critical'])],
                'observations' => 'nullable|string',
            ]);

            $inspection->update($validated);

            DB::commit();
            return response()->json(['message' => 'Inspeção atualizada', 'data' => $inspection]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('VehicleInspection update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar inspeção'], 500);
        }
    }

    public function destroy(VehicleInspection $inspection): JsonResponse
    {
        try {
            if ($inspection->tenant_id != auth()->user()->tenant_id) abort(403);
            $inspection->delete();
            return response()->json(['message' => 'Inspeção excluída']);
        } catch (\Exception $e) {
            Log::error('VehicleInspection destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir inspeção'], 500);
        }
    }
}
