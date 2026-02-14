<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Models\SlaPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SlaDashboardController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();

        return app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function overview(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $total = WorkOrder::where('tenant_id', $tenantId)
                ->whereNotNull('sla_policy_id')
                ->count();

            $responseCumprido = WorkOrder::where('tenant_id', $tenantId)
                ->whereNotNull('sla_policy_id')
                ->whereNotNull('sla_responded_at')
                ->where('sla_response_breached', false)
                ->count();

            $responseEstourado = WorkOrder::where('tenant_id', $tenantId)
                ->where('sla_response_breached', true)
                ->count();

            $resolutionCumprido = WorkOrder::where('tenant_id', $tenantId)
                ->whereNotNull('sla_policy_id')
                ->whereIn('status', [WorkOrder::STATUS_COMPLETED, WorkOrder::STATUS_INVOICED])
                ->where('sla_resolution_breached', false)
                ->count();

            $resolutionEstourado = WorkOrder::where('tenant_id', $tenantId)
                ->where('sla_resolution_breached', true)
                ->count();

            $emRisco = WorkOrder::where('tenant_id', $tenantId)
                ->whereNotNull('sla_due_at')
                ->where('sla_due_at', '>', now())
                ->where('sla_due_at', '<', now()->addHours(4))
                ->whereNotIn('status', [WorkOrder::STATUS_COMPLETED, WorkOrder::STATUS_INVOICED, WorkOrder::STATUS_CANCELLED])
                ->count();

            return response()->json([
                'total_com_sla' => $total,
                'response' => [
                    'cumprido' => $responseCumprido,
                    'estourado' => $responseEstourado,
                    'taxa' => $total > 0 ? round(($responseCumprido / max($responseCumprido + $responseEstourado, 1)) * 100, 1) : 0,
                ],
                'resolution' => [
                    'cumprido' => $resolutionCumprido,
                    'estourado' => $resolutionEstourado,
                    'taxa' => $total > 0 ? round(($resolutionCumprido / max($resolutionCumprido + $resolutionEstourado, 1)) * 100, 1) : 0,
                ],
                'em_risco' => $emRisco,
            ]);
        } catch (\Exception $e) {
            Log::error('SlaDashboard overview failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar overview SLA'], 500);
        }
    }

    public function breachedOrders(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $orders = WorkOrder::where('tenant_id', $tenantId)
                ->where(function ($q) {
                    $q->where('sla_response_breached', true)
                      ->orWhere('sla_resolution_breached', true);
                })
                ->with(['customer:id,name', 'assignee:id,name', 'slaPolicy:id,name'])
                ->orderByDesc('created_at')
                ->paginate($request->integer('per_page', 20));

            return response()->json($orders);
        } catch (\Exception $e) {
            Log::error('SlaDashboard breachedOrders failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar OS com SLA estourado'], 500);
        }
    }

    public function byPolicy(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $policies = SlaPolicy::where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->get()
                ->map(function ($policy) use ($tenantId) {
                    $total = WorkOrder::where('tenant_id', $tenantId)
                        ->where('sla_policy_id', $policy->id)
                        ->count();
                    $breached = WorkOrder::where('tenant_id', $tenantId)
                        ->where('sla_policy_id', $policy->id)
                        ->where(fn ($q) => $q->where('sla_response_breached', true)->orWhere('sla_resolution_breached', true))
                        ->count();

                    return [
                        'id' => $policy->id,
                        'name' => $policy->name,
                        'priority' => $policy->priority,
                        'total' => $total,
                        'breached' => $breached,
                        'compliance_rate' => $total > 0 ? round((($total - $breached) / $total) * 100, 1) : 100,
                    ];
                });

            return response()->json($policies);
        } catch (\Exception $e) {
            Log::error('SlaDashboard byPolicy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar SLA por política'], 500);
        }
    }
}
