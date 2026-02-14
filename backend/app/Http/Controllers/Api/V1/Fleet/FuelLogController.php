<?php
namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Fleet\FuelLog;
use App\Models\FleetVehicle;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class FuelLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
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
        } catch (\Exception $e) {
            Log::error('FuelLog index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar abastecimentos'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

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

            $previousLog = FuelLog::where('fleet_vehicle_id', $validated['fleet_vehicle_id'])
                ->where('odometer_km', '<', $validated['odometer_km'])
                ->latest('odometer_km')
                ->first();

            if ($previousLog) {
                $distance = $validated['odometer_km'] - $previousLog->odometer_km;
                $validated['consumption_km_l'] = $distance / $validated['liters'];
            }

            $log = FuelLog::create($validated);

            FleetVehicle::find($validated['fleet_vehicle_id'])?->update([
                'odometer_km' => $validated['odometer_km']
            ]);

            DB::commit();
            return response()->json(['message' => 'Abastecimento registrado', 'data' => $log], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('FuelLog store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar abastecimento'], 500);
        }
    }

    public function show(FuelLog $log): JsonResponse
    {
        try {
            if ($log->tenant_id != auth()->user()->tenant_id) abort(403);
            return response()->json($log->load(['vehicle', 'driver']));
        } catch (\Exception $e) {
            Log::error('FuelLog show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar abastecimento'], 500);
        }
    }

    public function update(Request $request, FuelLog $log): JsonResponse
    {
        try {
            DB::beginTransaction();

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

            DB::commit();
            return response()->json(['message' => 'Abastecimento atualizado', 'data' => $log]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('FuelLog update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar abastecimento'], 500);
        }
    }

    public function destroy(FuelLog $log): JsonResponse
    {
        try {
            if ($log->tenant_id != auth()->user()->tenant_id) abort(403);
            $log->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('FuelLog destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir abastecimento'], 500);
        }
    }
}
