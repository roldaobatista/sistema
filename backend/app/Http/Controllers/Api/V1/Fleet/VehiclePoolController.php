<?php
namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Fleet\VehiclePoolRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VehiclePoolController extends Controller
{
    public function index(Request $request)
    {
        $query = VehiclePoolRequest::where('tenant_id', $request->user()->tenant_id)
            ->with(['user:id,name', 'vehicle:id,plate,model']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        return response()->json($query->latest()->paginate($request->per_page ?? 15));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'fleet_vehicle_id' => 'nullable|exists:fleet_vehicles,id',
            'requested_start' => 'required|date',
            'requested_end' => 'required|date|after:requested_start',
            'purpose' => 'nullable|string',
        ]);

        $validated['tenant_id'] = $request->user()->tenant_id;
        $validated['user_id'] = $request->user()->id;
        $validated['status'] = 'pending';

        $poolRequest = VehiclePoolRequest::create($validated);

        return response()->json($poolRequest, 201);
    }

    public function show(VehiclePoolRequest $requestModel)
    {
        // O nome do parâmetro no router pode variar, mas o type-hint resolve
        if ($requestModel->tenant_id != auth()->user()->tenant_id) abort(403);
        return response()->json($requestModel->load(['user', 'vehicle']));
    }

    public function updateStatus(Request $request, $id)
    {
        $poolRequest = VehiclePoolRequest::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected', 'in_use', 'completed', 'cancelled'])],
            'actual_start' => 'nullable|date',
            'actual_end' => 'nullable|date',
            'fleet_vehicle_id' => 'nullable|exists:fleet_vehicles,id',
        ]);

        $poolRequest->update($validated);

        return response()->json($poolRequest);
    }

    public function destroy($id)
    {
        $poolRequest = VehiclePoolRequest::where('tenant_id', auth()->user()->tenant_id)
            ->findOrFail($id);
            
        if ($poolRequest->status != 'pending') {
            return response()->json(['message' => 'Apenas solicitações pendentes podem ser excluídas'], 422);
        }

        $poolRequest->delete();
        return response()->json(null, 204);
    }
}
