<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Services\Fleet\FleetDashboardService;
use App\Services\Fleet\FuelComparisonService;
use App\Services\Fleet\DriverScoringService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FleetAdvancedController extends Controller
{
    public function __construct(
        private FleetDashboardService $dashboardService,
        private FuelComparisonService $fuelComparisonService,
        private DriverScoringService $driverScoringService,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        $data = $this->dashboardService->getAdvancedDashboard($request->user()->tenant_id);
        return response()->json(['data' => $data]);
    }

    public function fuelComparison(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gasoline_price' => 'required|numeric|min:0',
            'ethanol_price' => 'required|numeric|min:0',
            'diesel_price' => 'nullable|numeric|min:0',
        ]);

        $result = $this->fuelComparisonService->compare(
            $validated['gasoline_price'],
            $validated['ethanol_price'],
            $validated['diesel_price'] ?? null,
        );

        return response()->json(['data' => $result]);
    }

    public function tripSimulation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'distance_km' => 'required|numeric|min:1',
            'avg_consumption' => 'required|numeric|min:0.1',
            'fuel_price' => 'required|numeric|min:0',
        ]);

        $result = $this->fuelComparisonService->simulateTrip(
            $validated['distance_km'],
            $validated['avg_consumption'],
            $validated['fuel_price'],
        );

        return response()->json(['data' => $result]);
    }

    public function driverScore(Request $request, int $driverId): JsonResponse
    {
        $result = $this->driverScoringService->calculateScore($driverId, $request->user()->tenant_id);
        return response()->json(['data' => $result]);
    }

    public function driverRanking(Request $request): JsonResponse
    {
        $ranking = $this->driverScoringService->getRanking($request->user()->tenant_id);
        return response()->json(['data' => $ranking]);
    }
}
