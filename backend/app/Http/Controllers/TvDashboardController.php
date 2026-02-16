<?php

namespace App\Http\Controllers;

use App\Models\Camera;
use App\Models\Role;
use App\Models\WorkOrder;
use App\Models\ServiceCall;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class TvDashboardController extends Controller
{
    public function index(): JsonResponse
    {
        try {
            $tenantId = auth()->user()->current_tenant_id ?? auth()->user()->tenant_id;

            // Cameras now filtered by BelongsToTenant global scope
            $cameras = Camera::where('is_active', true)
                ->orderBy('position')
                ->get(['id', 'name', 'stream_url', 'location', 'type']);

            // Technicians filtered by tenant explicitly
            $technicians = User::where(function ($q) use ($tenantId) {
                    $q->where('tenant_id', $tenantId)
                      ->orWhere('current_tenant_id', $tenantId);
                })
                ->whereHas('roles', fn($q) => $q->where('name', Role::TECNICO))
                ->where('is_active', true)
                ->get(['id', 'name', 'status', 'location_lat', 'location_lng', 'location_updated_at', 'avatar_url']);

            $openServiceCalls = ServiceCall::whereIn('status', ['opened', 'pending', 'in_progress'])
                ->with(['customer:id,name,latitude,longitude', 'technician:id,name'])
                ->orderBy('created_at', 'asc')
                ->take(20)
                ->get();

            $activeWorkOrders = WorkOrder::where('status', 'in_progress')
                ->with(['customer:id,name,latitude,longitude', 'technician:id,name', 'serviceCall:id,subject'])
                ->orderBy('started_at', 'desc')
                ->get();

            $latestWorkOrders = WorkOrder::with(['customer:id,name', 'technician:id,name'])
                ->orderBy('updated_at', 'desc')
                ->take(10)
                ->get();

            $kpis = [
                'chamados_hoje'    => ServiceCall::whereDate('created_at', today())->count(),
                'os_hoje'          => WorkOrder::whereDate('created_at', today())->count(),
                'os_em_execucao'   => $activeWorkOrders->count(),
                'os_finalizadas'   => WorkOrder::whereDate('completed_at', today())->where('status', 'completed')->count(),
                'tecnicos_online'  => $technicians->where('status', '!=', 'offline')->count(),
                'tecnicos_em_campo' => $technicians->whereIn('status', ['working', 'in_transit'])->count(),
                'tecnicos_total'   => $technicians->count(),
            ];

            return response()->json([
                'tenant_id' => $tenantId,
                'cameras' => $cameras,
                'operational' => [
                    'technicians' => $technicians,
                    'service_calls' => $openServiceCalls,
                    'work_orders' => $activeWorkOrders,
                    'latest_work_orders' => $latestWorkOrders,
                    'kpis' => $kpis,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('TvDashboard index failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => 'Erro ao carregar dashboard TV'], 500);
        }
    }
}
