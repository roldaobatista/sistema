<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\RoutingOptimizationService;
use Carbon\Carbon;

class RoutingController extends Controller
{
    public function __construct(private RoutingOptimizationService $routingService) {}

    /**
     * Retorna o plano de roteirização ótimo para o técnico autenticado na data
     */
    public function dailyPlan(Request $request)
    {
        $tenantId = app('current_tenant_id') ?? $request->user()->tenant_id;
        $techId = $request->user()->id;
        $date = $request->query('date', Carbon::today()->toDateString());

        $optimizedPath = $this->routingService->optimizeDailyPlan($tenantId, $techId, $date);

        return response()->json([
            'date' => $date,
            'technician_id' => $techId,
            'optimized_path' => $optimizedPath,
        ]);
    }
}
