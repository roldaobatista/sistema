<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Services\Fleet\FleetDashboardService;
use App\Services\Fleet\FuelComparisonService;
use App\Services\Fleet\DriverScoringService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class FleetAdvancedController extends Controller
{
    use ResolvesCurrentTenant;

    public function __construct(
        private FleetDashboardService $dashboardService,
        private FuelComparisonService $fuelComparisonService,
        private DriverScoringService $driverScoringService,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        try {
            $data = $this->dashboardService->getAdvancedDashboard($this->resolvedTenantId());
            return response()->json(['data' => $data]);
        } catch (\Exception $e) {
            Log::error('FleetAdvanced dashboard failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar dashboard da frota'], 500);
        }
    }

    public function fuelComparison(Request $request): JsonResponse
    {
        try {
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
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('FleetAdvanced fuelComparison failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na comparação de combustíveis'], 500);
        }
    }

    public function tripSimulation(Request $request): JsonResponse
    {
        try {
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
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('FleetAdvanced tripSimulation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na simulação de viagem'], 500);
        }
    }

    public function driverScore(Request $request, int $driverId): JsonResponse
    {
        try {
            $result = $this->driverScoringService->calculateScore($driverId, $this->resolvedTenantId());
            return response()->json(['data' => $result]);
        } catch (\Exception $e) {
            Log::error('FleetAdvanced driverScore failed', ['error' => $e->getMessage(), 'driverId' => $driverId]);
            return response()->json(['message' => 'Erro ao calcular score do motorista'], 500);
        }
    }

    public function driverRanking(Request $request): JsonResponse
    {
        try {
            $ranking = $this->driverScoringService->getRanking($this->resolvedTenantId());
            return response()->json(['data' => $ranking]);
        } catch (\Exception $e) {
            Log::error('FleetAdvanced driverRanking failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar ranking de motoristas'], 500);
        }
    }
}
