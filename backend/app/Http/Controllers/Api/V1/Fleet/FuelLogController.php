<?php
namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Fleet\FuelLog;
use App\Models\FleetVehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FuelLogController extends Controller
{
    public function index(Request $request)
    {
        $query = FuelLog::where('tenant_id', $request->user()->tenant_id)
            ->with(['vehicle:id,plate,model', 'driver:id,name']);

        if ($request->filled('fleet_vehicle_id')) {
            $query->where('fleet_vehicle_id', $request->fleet_vehicle_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('date', '<=', $request->date_to);
        }

        return response()->json($query->latest('date')->paginate($request->per_page ?? 15));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'fleet_vehicle_id' => 'required|exists:fleet_vehicles,id',
            'date' => 'required|date',
            'odometer_km' => 'required|integer',
            'liters' => 'required|numeric',
            'price_per_liter' => 'required|numeric',
            'total_value' => 'required|numeric',
            'fuel_type' => 'nullable|string',
            'gas_station' => 'nullable|string',
            'receipt_path' => 'nullable|string',
        ]);

        $validated['tenant_id'] = $request->user()->tenant_id;
        $validated['driver_id'] = $request->user()->id;

        // Cálculo de consumo se houver registro anterior
        $previousLog = FuelLog::where('fleet_vehicle_id', $validated['fleet_vehicle_id'])
            ->where('odometer_km', '<', $validated['odometer_km'])
            ->latest('odometer_km')
            ->first();

        if ($previousLog) {
            $distance = $validated['odometer_km'] - $previousLog->odometer_km;
            $validated['consumption_km_l'] = $distance / $validated['liters'];
        }

        $log = FuelLog::create($validated);

        // Atualiza odômetro no veículo
        FleetVehicle::find($validated['fleet_vehicle_id'])->update([
            'odometer_km' => $validated['odometer_km']
        ]);

        return response()->json($log, 201);
    }

    public function show(FuelLog $log)
    {
        if ($log->tenant_id != auth()->user()->tenant_id) abort(403);
        return response()->json($log->load(['vehicle', 'driver']));
    }

    public function update(Request $request, FuelLog $log)
    {
        if ($log->tenant_id != $request->user()->tenant_id) abort(403);

        $validated = $request->validate([
            'date' => 'sometimes|date',
            'odometer_km' => 'sometimes|integer',
            'liters' => 'sometimes|numeric',
            'price_per_liter' => 'sometimes|numeric',
            'total_value' => 'sometimes|numeric',
            'fuel_type' => 'nullable|string',
            'gas_station' => 'nullable|string',
            'receipt_path' => 'nullable|string',
        ]);

        $log->update($validated);

        return response()->json($log);
    }

    public function destroy(FuelLog $log)
    {
        if ($log->tenant_id != auth()->user()->tenant_id) abort(403);
        $log->delete();
        return response()->json(null, 204);
    }
}
