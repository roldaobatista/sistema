<?php

namespace App\Http\Controllers\Api\V1\Operational;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Services\RouteOptimizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class RouteOptimizationController extends Controller
{
    private RouteOptimizationService $service;

    public function __construct(RouteOptimizationService $service)
    {
        $this->service = $service;
    }

    public function optimize(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'work_order_ids' => 'required|array',
                'work_order_ids.*' => 'exists:work_orders,id',
                'start_lat' => 'nullable|numeric',
                'start_lng' => 'nullable|numeric',
            ]);

            $workOrders = WorkOrder::with('customer')
                ->whereIn('id', $validated['work_order_ids'])
                ->get();

            if ($workOrders->isEmpty()) {
                return response()->json([]);
            }

            $startLat = $validated['start_lat'] ?? $workOrders->first()->customer->latitude;
            $startLng = $validated['start_lng'] ?? $workOrders->first()->customer->longitude;

            if ($startLat === null || $startLng === null) {
                return response()->json($workOrders);
            }

            $optimized = $this->service->optimize($workOrders, (float) $startLat, (float) $startLng);

            return response()->json($optimized->values());
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('RouteOptimization optimize failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao otimizar rota'], 500);
        }
    }
}
