<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\VehicleInspection;
use App\Models\FleetVehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VehicleInspectionController extends Controller
{
    public function index(Request $request)
    {
        $query = VehicleInspection::where('tenant_id', $request->user()->tenant_id)
            ->with(['vehicle:id,plate,model', 'inspector:id,name']);

        if ($request->filled('fleet_vehicle_id')) {
            $query->where('fleet_vehicle_id', $request->fleet_vehicle_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->latest('inspection_date')->paginate($request->per_page ?? 15));
    }

    public function store(Request $request)
    {
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

        // Atualiza odômetro do veículo se a inspeção for a mais recente
        FleetVehicle::find($validated['fleet_vehicle_id'])->update([
            'odometer_km' => $validated['odometer_km']
        ]);

        return response()->json($inspection, 201);
    }

    public function show(VehicleInspection $inspection)
    {
        if ($inspection->tenant_id != auth()->user()->tenant_id) abort(403);
        return response()->json($inspection->load(['vehicle', 'inspector']));
    }

    public function update(Request $request, VehicleInspection $inspection)
    {
        if ($inspection->tenant_id != $request->user()->tenant_id) abort(403);

        $validated = $request->validate([
            'inspection_date' => 'sometimes|date',
            'odometer_km' => 'sometimes|integer',
            'checklist_data' => 'sometimes|array',
            'status' => ['sometimes', Rule::in(['ok', 'issues_found', 'critical'])],
            'observations' => 'nullable|string',
        ]);

        $inspection->update($validated);

        return response()->json($inspection);
    }

    public function destroy(VehicleInspection $inspection)
    {
        if ($inspection->tenant_id != auth()->user()->tenant_id) abort(403);
        $inspection->delete();
        return response()->json(null, 204);
    }
}
