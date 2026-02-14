<?php
namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Fleet\VehicleTire;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VehicleTireController extends Controller
{
    public function index(Request $request)
    {
        $query = VehicleTire::where('tenant_id', $request->user()->tenant_id)
            ->with('vehicle:id,plate,model');

        if ($request->filled('fleet_vehicle_id')) {
            $query->where('fleet_vehicle_id', $request->fleet_vehicle_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('serial_number', 'like', "%{$search}%")
                  ->orWhere('brand', 'like', "%{$search}%")
                  ->orWhere('model', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate($request->per_page ?? 15));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'fleet_vehicle_id' => 'required|exists:fleet_vehicles,id',
            'serial_number' => 'nullable|string',
            'brand' => 'nullable|string',
            'model' => 'nullable|string',
            'position' => 'required|string',
            'tread_depth' => 'nullable|numeric',
            'retread_count' => 'nullable|integer',
            'installed_at' => 'nullable|date',
            'installed_km' => 'nullable|integer',
            'status' => ['required', Rule::in(['active', 'retired', 'warehouse'])],
        ]);

        $validated['tenant_id'] = $request->user()->tenant_id;

        $tire = VehicleTire::create($validated);

        return response()->json($tire, 201);
    }

    public function show(VehicleTire $tire)
    {
        if ($tire->tenant_id != auth()->user()->tenant_id) abort(403);
        return response()->json($tire->load('vehicle'));
    }

    public function update(Request $request, VehicleTire $tire)
    {
        if ($tire->tenant_id != $request->user()->tenant_id) abort(403);

        $validated = $request->validate([
            'serial_number' => 'nullable|string',
            'brand' => 'nullable|string',
            'model' => 'nullable|string',
            'position' => 'sometimes|string',
            'tread_depth' => 'nullable|numeric',
            'retread_count' => 'nullable|integer',
            'installed_at' => 'nullable|date',
            'installed_km' => 'nullable|integer',
            'status' => ['sometimes', Rule::in(['active', 'retired', 'warehouse'])],
        ]);

        $tire->update($validated);

        return response()->json($tire);
    }

    public function destroy(VehicleTire $tire)
    {
        if ($tire->tenant_id != auth()->user()->tenant_id) abort(403);
        $tire->delete();
        return response()->json(null, 204);
    }
}
