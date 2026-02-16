<?php

namespace App\Http\Controllers;

use App\Models\Camera;
use App\Models\Role;
use App\Models\WorkOrder;
use App\Models\ServiceCall;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class TvDashboardController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(): JsonResponse
    {
        try {
            $tenantId = $this->tenantId();

            $cameras = Camera::where('is_active', true)
                ->orderBy('position')
                ->get(['id', 'name', 'stream_url', 'location', 'type']);

            $technicians = $this->getTechnicians($tenantId);
            $openServiceCalls = $this->getOpenServiceCalls();
            $activeWorkOrders = $this->getActiveWorkOrders();
            $latestWorkOrders = $this->getLatestWorkOrders();
            $kpis = $this->getKpis($tenantId, $technicians, $activeWorkOrders);

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

    public function kpis(): JsonResponse
    {
        try {
            $tenantId = $this->tenantId();
            $technicians = $this->getTechnicians($tenantId);
            $activeWorkOrders = $this->getActiveWorkOrders();
            $kpis = $this->getKpis($tenantId, $technicians, $activeWorkOrders);

            return response()->json($kpis);
        } catch (\Exception $e) {
            Log::error('TvDashboard kpis failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar KPIs'], 500);
        }
    }

    public function mapData(): JsonResponse
    {
        try {
            $tenantId = $this->tenantId();

            return response()->json([
                'technicians' => $this->getTechnicians($tenantId),
                'work_orders' => $this->getActiveWorkOrders(),
                'service_calls' => $this->getOpenServiceCalls(),
            ]);
        } catch (\Exception $e) {
            Log::error('TvDashboard mapData failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar dados do mapa'], 500);
        }
    }

    public function alerts(): JsonResponse
    {
        try {
            $tenantId = $this->tenantId();
            $alerts = [];

            $technicians = $this->getTechnicians($tenantId);
            foreach ($technicians as $tech) {
                if (!$tech->location_updated_at) continue;
                $diffMin = now()->diffInMinutes($tech->location_updated_at);
                if ($diffMin > 30 && $tech->status !== 'offline') {
                    $alerts[] = [
                        'type' => 'technician_offline',
                        'severity' => 'warning',
                        'message' => "{$tech->name} sem sinal há {$diffMin} minutos",
                        'entity_id' => $tech->id,
                        'created_at' => now()->toISOString(),
                    ];
                }
            }

            $unattendedCalls = ServiceCall::whereIn('status', ['opened', 'pending'])
                ->where('created_at', '<', now()->subMinutes(30))
                ->with('customer:id,name')
                ->take(10)
                ->get();

            foreach ($unattendedCalls as $call) {
                $diffMin = now()->diffInMinutes($call->created_at);
                $alerts[] = [
                    'type' => 'unattended_call',
                    'severity' => $diffMin > 60 ? 'critical' : 'warning',
                    'message' => "Chamado #{$call->id} ({$call->customer?->name}) sem atendimento há {$diffMin}min",
                    'entity_id' => $call->id,
                    'created_at' => $call->created_at->toISOString(),
                ];
            }

            $longRunningOs = WorkOrder::where('status', 'in_progress')
                ->where('started_at', '<', now()->subHours(4))
                ->with(['customer:id,name', 'assignee:id,name'])
                ->take(10)
                ->get();

            foreach ($longRunningOs as $os) {
                $hours = now()->diffInHours($os->started_at);
                $alerts[] = [
                    'type' => 'long_running_os',
                    'severity' => $hours > 8 ? 'critical' : 'warning',
                    'message' => "OS #{$os->os_number} em execução há {$hours}h ({$os->assignee?->name})",
                    'entity_id' => $os->id,
                    'created_at' => $os->started_at->toISOString(),
                ];
            }

            usort($alerts, fn ($a, $b) => ($b['severity'] === 'critical' ? 1 : 0) - ($a['severity'] === 'critical' ? 1 : 0));

            return response()->json(['alerts' => $alerts]);
        } catch (\Exception $e) {
            Log::error('TvDashboard alerts failed', ['error' => $e->getMessage()]);
            return response()->json(['alerts' => []], 500);
        }
    }

    private function getTechnicians(int $tenantId)
    {
        return User::where(function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)
                  ->orWhere('current_tenant_id', $tenantId);
            })
            ->whereHas('roles', fn ($q) => $q->where('name', Role::TECNICO))
            ->where('is_active', true)
            ->get(['id', 'name', 'status', 'location_lat', 'location_lng', 'location_updated_at', 'avatar_url']);
    }

    private function getOpenServiceCalls()
    {
        return ServiceCall::whereIn('status', ['opened', 'pending', 'in_progress'])
            ->with(['customer:id,name,latitude,longitude', 'technician:id,name'])
            ->orderBy('created_at', 'asc')
            ->take(20)
            ->get();
    }

    private function getActiveWorkOrders()
    {
        return WorkOrder::where('status', 'in_progress')
            ->with(['customer:id,name,latitude,longitude', 'assignee:id,name', 'serviceCall:id,subject'])
            ->orderBy('started_at', 'desc')
            ->get();
    }

    private function getLatestWorkOrders()
    {
        return WorkOrder::with(['customer:id,name', 'assignee:id,name'])
            ->orderBy('updated_at', 'desc')
            ->take(10)
            ->get();
    }

    private function getKpis(int $tenantId, $technicians, $activeWorkOrders): array
    {
        $cacheKey = "tv-kpis-{$tenantId}";

        return Cache::remember($cacheKey, 30, function () use ($technicians, $activeWorkOrders) {
            $yesterday = today()->subDay();

            $chamadosHoje = ServiceCall::whereDate('created_at', today())->count();
            $chamadosOntem = ServiceCall::whereDate('created_at', $yesterday)->count();

            $osHoje = WorkOrder::whereDate('created_at', today())->count();
            $osOntem = WorkOrder::whereDate('created_at', $yesterday)->count();

            $osFinalizadasHoje = WorkOrder::whereDate('completed_at', today())->where('status', 'completed')->count();
            $osFinalizadasOntem = WorkOrder::whereDate('completed_at', $yesterday)->where('status', 'completed')->count();

            $avgResponseMin = null;
            if (Schema::hasColumn('service_calls', 'first_response_at')) {
                $avgResponseMin = ServiceCall::whereDate('created_at', today())
                    ->whereNotNull('first_response_at')
                    ->selectRaw('AVG(TIMESTAMPDIFF(MINUTE, created_at, first_response_at)) as avg_min')
                    ->value('avg_min');
            }

            $avgExecutionMin = null;
            if (Schema::hasColumn('work_orders', 'started_at') && Schema::hasColumn('work_orders', 'completed_at')) {
                $avgExecutionMin = WorkOrder::whereDate('completed_at', today())
                    ->where('status', 'completed')
                    ->whereNotNull('started_at')
                    ->selectRaw('AVG(TIMESTAMPDIFF(MINUTE, started_at, completed_at)) as avg_min')
                    ->value('avg_min');
            }

            return [
                'chamados_hoje' => $chamadosHoje,
                'chamados_ontem' => $chamadosOntem,
                'os_hoje' => $osHoje,
                'os_ontem' => $osOntem,
                'os_em_execucao' => $activeWorkOrders->count(),
                'os_finalizadas' => $osFinalizadasHoje,
                'os_finalizadas_ontem' => $osFinalizadasOntem,
                'tecnicos_online' => $technicians->where('status', '!=', 'offline')->count(),
                'tecnicos_em_campo' => $technicians->whereIn('status', ['working', 'in_transit'])->count(),
                'tecnicos_total' => $technicians->count(),
                'tempo_medio_resposta_min' => $avgResponseMin ? round($avgResponseMin) : null,
                'tempo_medio_execucao_min' => $avgExecutionMin ? round($avgExecutionMin) : null,
            ];
        });
    }
}
