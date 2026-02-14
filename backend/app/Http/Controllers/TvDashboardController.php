<?php

namespace App\Http\Controllers;

use App\Models\Camera;
use App\Models\WorkOrder;
use App\Models\ServiceCall;
use App\Models\Technician; // Assumindo que Technician é um Model ou User com role
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TvDashboardController extends Controller
{
    /**
     * Retorna todos os dados para o Wallboard (TV).
     * Agrega câmeras ativas e KPIs operacionais.
     */
    public function index()
    {
        // 1. Câmeras Ativas
        $cameras = Camera::where('is_active', true)
            ->orderBy('position')
            ->get(['id', 'name', 'stream_url']);

        // 2. Técnicos (Com localização e status)
        $technicians = User::whereHas('roles', function($q) {
                $q->where('name', 'technician');
            })
            ->where('is_active', true)
            ->get(['id', 'name', 'status', 'location_lat', 'location_lng', 'location_updated_at', 'avatar_url']); // Add avatar if exists

        // 3. Chamados em Aberto (Service Calls)
        // 3. Chamados em Aberto (Service Calls)
        $openServiceCalls = ServiceCall::whereIn('status', ['opened', 'pending', 'in_progress'])
            ->with(['customer:id,name,latitude,longitude', 'technician:id,name'])
            ->orderBy('created_at', 'asc')
            ->take(10)
            ->get();

        // 4. Ordens de Serviço em Execução (Detalhado)
        $activeWorkOrders = WorkOrder::where('status', 'in_progress')
            ->with(['customer:id,name,latitude,longitude', 'technician:id,name', 'serviceCall:id,subject'])
            ->orderBy('started_at', 'desc')
            ->get();

        // 5. Últimas Ordens de Serviço (Ticker)
        $latestWorkOrders = WorkOrder::with(['customer:id,name', 'technician:id,name'])
            ->orderBy('updated_at', 'desc')
            ->take(5)
            ->get();

        // 6. KPIs Rápidos
        $kpis = [
            'chamados_hoje' => ServiceCall::whereDate('created_at', today())->count(),
            'os_hoje' => WorkOrder::whereDate('created_at', today())->count(),
            'os_em_execucao' => $activeWorkOrders->count(),
            'tecnicos_online' => $technicians->where('status', '!=', 'offline')->count(),
            'tecnicos_em_campo' => $technicians->whereIn('status', ['working', 'in_transit'])->count(),
        ];

        return response()->json([
            'tenant_id' => auth()->user()->current_tenant_id ?? auth()->user()->tenant_id,
            'cameras' => $cameras,
            'operational' => [
                'technicians' => $technicians,
                'service_calls' => $openServiceCalls,
                'work_orders' => $activeWorkOrders,
                'latest_work_orders' => $latestWorkOrders,
                'kpis' => $kpis
            ]
        ]);
    }
}
