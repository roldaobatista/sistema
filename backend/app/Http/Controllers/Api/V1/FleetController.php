<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FleetVehicle;
use App\Models\VehicleInspection;
use App\Models\TrafficFine;
use App\Models\ToolInventory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FleetController extends Controller
{
    // ─── VEHICLES ────────────────────────────────────────────────

    public function indexVehicles(Request $request): JsonResponse
    {
        $query = FleetVehicle::where('tenant_id', $request->user()->tenant_id)
            ->with('assignedUser:id,name');

        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('plate', 'like', "%{$request->search}%")
                  ->orWhere('brand', 'like', "%{$request->search}%")
                  ->orWhere('model', 'like', "%{$request->search}%");
            });
        }

        return response()->json($query->orderBy('plate')->paginate($request->input('per_page', 20)));
    }

    public function storeVehicle(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plate' => 'required|string|max:10',
            'brand' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'year' => 'nullable|integer|min:1900|max:2100',
            'color' => 'nullable|string|max:50',
            'type' => 'nullable|in:car,truck,motorcycle,van',
            'fuel_type' => 'nullable|in:flex,diesel,gasoline,electric,ethanol',
            'odometer_km' => 'nullable|integer|min:0',
            'renavam' => 'nullable|string|max:20',
            'chassis' => 'nullable|string|max:30',
            'crlv_expiry' => 'nullable|date',
            'insurance_expiry' => 'nullable|date',
            'next_maintenance' => 'nullable|date',
            'purchase_value' => 'nullable|numeric|min:0',
            'assigned_user_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:active,maintenance,inactive',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $vehicle = FleetVehicle::create($validated);
            DB::commit();
            return response()->json(['message' => 'Veículo cadastrado com sucesso', 'data' => $vehicle], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('FleetVehicle create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao cadastrar veículo'], 500);
        }
    }

    public function showVehicle(FleetVehicle $vehicle): JsonResponse
    {
        $vehicle->load(['assignedUser:id,name', 'inspections' => fn($q) => $q->latest()->take(5), 'fines', 'tools']);
        return response()->json(['data' => $vehicle]);
    }

    public function updateVehicle(Request $request, FleetVehicle $vehicle): JsonResponse
    {
        $validated = $request->validate([
            'plate' => 'sometimes|string|max:10',
            'brand' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'year' => 'nullable|integer|min:1900|max:2100',
            'color' => 'nullable|string|max:50',
            'type' => 'nullable|in:car,truck,motorcycle,van',
            'fuel_type' => 'nullable|in:flex,diesel,gasoline,electric,ethanol',
            'odometer_km' => 'nullable|integer|min:0',
            'renavam' => 'nullable|string|max:20',
            'chassis' => 'nullable|string|max:30',
            'crlv_expiry' => 'nullable|date',
            'insurance_expiry' => 'nullable|date',
            'next_maintenance' => 'nullable|date',
            'purchase_value' => 'nullable|numeric|min:0',
            'assigned_user_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:active,maintenance,inactive',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $vehicle->update($validated);
            DB::commit();
            return response()->json(['message' => 'Veículo atualizado com sucesso', 'data' => $vehicle->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('FleetVehicle update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar veículo'], 500);
        }
    }

    public function destroyVehicle(FleetVehicle $vehicle): JsonResponse
    {
        try {
            DB::beginTransaction();
            $vehicle->delete();
            DB::commit();
            return response()->json(['message' => 'Veículo removido com sucesso']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('FleetVehicle delete failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover veículo'], 500);
        }
    }

    public function dashboardFleet(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $vehicles = FleetVehicle::where('tenant_id', $tenantId);

        return response()->json(['data' => [
            'total_vehicles' => $vehicles->count(),
            'active' => (clone $vehicles)->where('status', 'active')->count(),
            'in_maintenance' => (clone $vehicles)->where('status', 'maintenance')->count(),
            'expiring_crlv' => (clone $vehicles)->where('crlv_expiry', '<=', now()->addMonth())->count(),
            'expiring_insurance' => (clone $vehicles)->where('insurance_expiry', '<=', now()->addMonth())->count(),
            'pending_maintenance' => (clone $vehicles)->where('next_maintenance', '<=', now())->count(),
            'pending_fines' => TrafficFine::where('tenant_id', $tenantId)->where('status', 'pending')->count(),
        ]]);
    }

    // ─── INSPECTIONS ─────────────────────────────────────────────

    public function indexInspections(Request $request, FleetVehicle $vehicle): JsonResponse
    {
        return response()->json(
            $vehicle->inspections()
                ->with('inspector:id,name')
                ->orderByDesc('inspection_date')
                ->paginate($request->input('per_page', 20))
        );
    }

    public function storeInspection(Request $request, FleetVehicle $vehicle): JsonResponse
    {
        $validated = $request->validate([
            'inspection_date' => 'required|date',
            'odometer_km' => 'required|integer|min:0',
            'checklist_data' => 'nullable|array',
            'status' => 'nullable|in:ok,issues_found,critical',
            'observations' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $validated['inspector_id'] = $request->user()->id;
            $validated['fleet_vehicle_id'] = $vehicle->id;

            $inspection = VehicleInspection::create($validated);

            if ($validated['odometer_km'] > $vehicle->odometer_km) {
                $vehicle->update(['odometer_km' => $validated['odometer_km']]);
            }

            DB::commit();
            return response()->json(['message' => 'Inspeção registrada com sucesso', 'data' => $inspection], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('VehicleInspection create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar inspeção'], 500);
        }
    }

    // ─── TRAFFIC FINES ───────────────────────────────────────────

    public function indexFines(Request $request): JsonResponse
    {
        $query = TrafficFine::where('tenant_id', $request->user()->tenant_id)
            ->with(['vehicle:id,plate,brand,model', 'driver:id,name']);

        if ($request->filled('status')) $query->where('status', $request->status);

        return response()->json($query->orderByDesc('fine_date')->paginate($request->input('per_page', 20)));
    }

    public function storeFine(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fleet_vehicle_id' => 'required|exists:fleet_vehicles,id',
            'driver_id' => 'nullable|exists:users,id',
            'fine_date' => 'required|date',
            'infraction_code' => 'nullable|string|max:30',
            'description' => 'nullable|string',
            'amount' => 'required|numeric|min:0',
            'points' => 'nullable|integer|min:0',
            'due_date' => 'nullable|date',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $fine = TrafficFine::create($validated);
            DB::commit();
            return response()->json(['message' => 'Multa registrada com sucesso', 'data' => $fine], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('TrafficFine create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar multa'], 500);
        }
    }

    public function updateFine(Request $request, TrafficFine $fine): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,paid,appealed,cancelled',
        ]);

        try {
            DB::beginTransaction();
            $fine->update($validated);
            DB::commit();
            return response()->json(['message' => 'Multa atualizada', 'data' => $fine->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar multa'], 500);
        }
    }

    // ─── TOOL INVENTORY ──────────────────────────────────────────

    public function indexTools(Request $request): JsonResponse
    {
        $query = ToolInventory::where('tenant_id', $request->user()->tenant_id)
            ->with(['assignedTo:id,name', 'vehicle:id,plate']);

        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('serial_number', 'like', "%{$request->search}%");
            });
        }

        return response()->json($query->orderBy('name')->paginate($request->input('per_page', 20)));
    }

    public function storeTool(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'serial_number' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:50',
            'assigned_to' => 'nullable|exists:users,id',
            'fleet_vehicle_id' => 'nullable|exists:fleet_vehicles,id',
            'calibration_due' => 'nullable|date',
            'status' => 'nullable|in:available,in_use,maintenance,retired',
            'value' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $tool = ToolInventory::create($validated);
            DB::commit();
            return response()->json(['message' => 'Ferramenta cadastrada', 'data' => $tool], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('ToolInventory create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao cadastrar ferramenta'], 500);
        }
    }

    public function updateTool(Request $request, ToolInventory $tool): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'serial_number' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:50',
            'assigned_to' => 'nullable|exists:users,id',
            'fleet_vehicle_id' => 'nullable|exists:fleet_vehicles,id',
            'calibration_due' => 'nullable|date',
            'status' => 'nullable|in:available,in_use,maintenance,retired',
            'value' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $tool->update($validated);
            DB::commit();
            return response()->json(['message' => 'Ferramenta atualizada', 'data' => $tool->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar ferramenta'], 500);
        }
    }

    public function destroyTool(ToolInventory $tool): JsonResponse
    {
        try {
            DB::beginTransaction();
            $tool->delete();
            DB::commit();
            return response()->json(['message' => 'Ferramenta removida']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('ToolInventory delete failed', ['id' => $tool->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover ferramenta'], 500);
        }
    }
}
