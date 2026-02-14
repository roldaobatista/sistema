<?php

namespace App\Http\Controllers\Api\V1\Operational;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Services\RouteOptimizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RouteOptimizationController extends Controller
{
    private RouteOptimizationService $service;

    public function __construct(RouteOptimizationService $service)
    {
        $this->service = $service;
    }

    /**
     * Calculate optimized route for a list of work orders.
     */
    public function optimize(Request $request): JsonResponse
    {
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

        // Default start location if not provided?
        // Maybe take the first work order's location or technician's last known location.
        // For now, we rely on frontend sending it.
        $startLat = $validated['start_lat'] ?? $workOrders->first()->customer->latitude;
        $startLng = $validated['start_lng'] ?? $workOrders->first()->customer->longitude;

        if ($startLat === null || $startLng === null) {
            // Cannot optimize without start point
            return response()->json($workOrders);
        }

        $optimized = $this->service->optimize($workOrders, (float) $startLat, (float) $startLng);

        // Return re-indexed array
        return response()->json($optimized->values());
    }
}
