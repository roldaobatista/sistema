<?php
namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Fleet\VehicleTire;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class VehicleTireController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
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
        } catch (\Exception $e) {
            Log::error('VehicleTire index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar pneus'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

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

            DB::commit();
            return response()->json(['message' => 'Pneu registrado', 'data' => $tire], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('VehicleTire store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar pneu'], 500);
        }
    }

    public function show(VehicleTire $tire): JsonResponse
    {
        try {
            if ($tire->tenant_id != auth()->user()->tenant_id) abort(403);
            return response()->json($tire->load('vehicle'));
        } catch (\Exception $e) {
            Log::error('VehicleTire show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar pneu'], 500);
        }
    }

    public function update(Request $request, VehicleTire $tire): JsonResponse
    {
        try {
            DB::beginTransaction();

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

            DB::commit();
            return response()->json(['message' => 'Pneu atualizado', 'data' => $tire]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('VehicleTire update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar pneu'], 500);
        }
    }

    public function destroy(VehicleTire $tire): JsonResponse
    {
        try {
            if ($tire->tenant_id != auth()->user()->tenant_id) abort(403);
            $tire->delete();
            return response()->json(['message' => 'Pneu excluído']);
        } catch (\Exception $e) {
            Log::error('VehicleTire destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir pneu'], 500);
        }
    }
}
