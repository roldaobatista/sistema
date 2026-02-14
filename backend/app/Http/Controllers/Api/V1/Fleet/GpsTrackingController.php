<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\FleetVehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GpsTrackingController extends Controller
{
    /**
     * Posições atuais de todos os veículos (mapa ao vivo).
     */
    public function livePositions(Request $request): JsonResponse
    {
        $vehicles = FleetVehicle::where('tenant_id', $request->user()->tenant_id)
            ->whereNotNull('last_gps_lat')
            ->whereNotNull('last_gps_lng')
            ->select('id', 'plate', 'model', 'brand', 'status', 'last_gps_lat', 'last_gps_lng', 'last_gps_at', 'assigned_user_id')
            ->with('assignedUser:id,name')
            ->get();

        return response()->json(['data' => $vehicles]);
    }

    /**
     * Recebe posição GPS de um veículo (chamado pelo app mobile).
     */
    public function updatePosition(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fleet_vehicle_id' => 'required|exists:fleet_vehicles,id',
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
        ]);

        $vehicle = FleetVehicle::where('id', $validated['fleet_vehicle_id'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $vehicle->update([
            'last_gps_lat' => $validated['lat'],
            'last_gps_lng' => $validated['lng'],
            'last_gps_at' => now(),
        ]);

        // Salvar no histórico
        DB::table('gps_tracking_history')->insert([
            'tenant_id' => $request->user()->tenant_id,
            'fleet_vehicle_id' => $validated['fleet_vehicle_id'],
            'lat' => $validated['lat'],
            'lng' => $validated['lng'],
            'recorded_at' => now(),
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Posição atualizada']);
    }

    /**
     * Histórico de posições de um veículo (para desenhar rota no mapa).
     */
    public function history(Request $request, int $vehicleId): JsonResponse
    {
        $vehicle = FleetVehicle::where('id', $vehicleId)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $history = DB::table('gps_tracking_history')
            ->where('fleet_vehicle_id', $vehicleId)
            ->where('tenant_id', $request->user()->tenant_id)
            ->when($request->filled('date'), fn ($q) => $q->whereDate('recorded_at', $request->date))
            ->orderBy('recorded_at')
            ->limit(500)
            ->get(['lat', 'lng', 'recorded_at']);

        return response()->json(['data' => $history, 'vehicle' => $vehicle->only('id', 'plate', 'model')]);
    }
}
