<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SlaEscalationService;
use App\Services\TechnicianProductivityService;
use App\Services\AutoAssignmentService;
use App\Models\AutoAssignmentRule;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ServiceOpsController extends Controller
{
    public function __construct(
        private SlaEscalationService $slaService,
        private TechnicianProductivityService $productivityService,
        private AutoAssignmentService $autoAssignService,
    ) {}

    // ─── SLA (#1) ───────────────────────────────────────────────

    public function slaDashboard(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        return response()->json($this->slaService->getDashboard($tenantId));
    }

    public function runSlaChecks(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $results = $this->slaService->runSlaChecks($tenantId);
        return response()->json(['message' => 'SLA checks completed', 'data' => $results]);
    }

    public function slaStatus(WorkOrder $workOrder): JsonResponse
    {
        $evaluation = $this->slaService->evaluateSla($workOrder);
        return response()->json($evaluation ?? ['status' => 'ok', 'message' => 'No SLA configured or not at risk']);
    }

    // ─── OS Multi-Equipamento em Lote (#2B) ─────────────────────

    public function bulkCreateWorkOrders(Request $request): JsonResponse
    {
        $request->validate([
            'template' => 'required|array',
            'equipment_ids' => 'required|array|min:1',
            'equipment_ids.*' => 'integer|exists:equipments,id',
        ]);

        $template = $request->input('template');
        $equipmentIds = $request->input('equipment_ids');
        $user = $request->user();
        $created = [];

        DB::beginTransaction();
        try {
            foreach ($equipmentIds as $equipmentId) {
                $data = array_merge($template, [
                    'equipment_id' => $equipmentId,
                    'company_id' => $user->company_id,
                    'created_by' => $user->id,
                ]);
                $wo = WorkOrder::create($data);
                $created[] = $wo->id;
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error creating batch', 'error' => $e->getMessage()], 500);
        }

        return response()->json([
            'message' => count($created) . ' OS created successfully',
            'work_order_ids' => $created,
        ], 201);
    }

    // ─── Roteirização de OS em Lote (#3B) ───────────────────────

    public function optimizeRoute(Request $request): JsonResponse
    {
        $request->validate([
            'work_order_ids' => 'required|array|min:2',
            'work_order_ids.*' => 'integer|exists:work_orders,id',
            'start_latitude' => 'nullable|numeric',
            'start_longitude' => 'nullable|numeric',
        ]);

        $tenantId = $request->user()->company_id;
        $workOrders = WorkOrder::where('company_id', $tenantId)
            ->whereIn('id', $request->input('work_order_ids'))
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get(['id', 'latitude', 'longitude', 'customer_id', 'endereco']);

        if ($workOrders->count() < 2) {
            return response()->json(['message' => 'Need at least 2 geocoded work orders'], 422);
        }

        // Nearest-neighbor TSP heuristic
        $startLat = $request->input('start_latitude') ?? $workOrders->first()->latitude;
        $startLng = $request->input('start_longitude') ?? $workOrders->first()->longitude;

        $remaining = $workOrders->keyBy('id')->all();
        $route = [];
        $currentLat = $startLat;
        $currentLng = $startLng;
        $totalDistance = 0;

        while (!empty($remaining)) {
            $nearest = null;
            $nearestDist = PHP_FLOAT_MAX;

            foreach ($remaining as $wo) {
                $dist = $this->haversine($currentLat, $currentLng, $wo->latitude, $wo->longitude);
                if ($dist < $nearestDist) {
                    $nearestDist = $dist;
                    $nearest = $wo;
                }
            }

            $route[] = [
                'work_order_id' => $nearest->id,
                'latitude' => $nearest->latitude,
                'longitude' => $nearest->longitude,
                'address' => $nearest->endereco,
                'distance_from_previous_km' => round($nearestDist, 2),
            ];

            $totalDistance += $nearestDist;
            $currentLat = $nearest->latitude;
            $currentLng = $nearest->longitude;
            unset($remaining[$nearest->id]);
        }

        return response()->json([
            'total_distance_km' => round($totalDistance, 2),
            'estimated_travel_hours' => round($totalDistance / 40, 1), // ~40km/h avg urban
            'route' => $route,
        ]);
    }

    // ─── Checklist Fotográfico (#4) ─────────────────────────────

    public function validatePhotoChecklist(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $request->validate([
            'step' => 'required|string|in:before,during,after',
            'photos' => 'required|array|min:1',
            'photos.*.file' => 'required|image|max:10240',
            'photos.*.description' => 'nullable|string|max:255',
            'photos.*.checklist_item_id' => 'nullable|integer',
        ]);

        $step = $request->input('step');
        $uploaded = [];

        foreach ($request->file('photos') as $index => $photo) {
            $path = $photo['file']->store("work-orders/{$workOrder->id}/checklist/{$step}", 'public');
            $uploaded[] = [
                'path' => $path,
                'step' => $step,
                'description' => $request->input("photos.{$index}.description"),
                'checklist_item_id' => $request->input("photos.{$index}.checklist_item_id"),
            ];
        }

        // Save to WO metadata
        $checklist = $workOrder->photo_checklist ?? [];
        $checklist[$step] = array_merge($checklist[$step] ?? [], $uploaded);
        $workOrder->update(['photo_checklist' => $checklist]);

        return response()->json([
            'message' => count($uploaded) . ' photos uploaded',
            'step' => $step,
            'photos' => $uploaded,
        ]);
    }

    public function getPhotoChecklist(WorkOrder $workOrder): JsonResponse
    {
        $checklist = $workOrder->photo_checklist ?? [];
        $status = [
            'before' => !empty($checklist['before']),
            'during' => !empty($checklist['during']),
            'after' => !empty($checklist['after']),
            'complete' => !empty($checklist['before']) && !empty($checklist['after']),
        ];

        return response()->json([
            'checklist' => $checklist,
            'status' => $status,
        ]);
    }

    // ─── NPS Widget Dashboard (#5B) ─────────────────────────────

    public function npsDashboard(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $from = $request->input('from', now()->subMonths(3)->toDateString());
        $to = $request->input('to', now()->toDateString());

        $responses = DB::table('nps_responses')
            ->where('company_id', $tenantId)
            ->whereBetween('created_at', [$from, $to]);

        $total = $responses->count();
        $avgScore = $responses->avg('score');

        // NPS calculation: % promoters (9-10) - % detractors (0-6)
        $promoters = (clone $responses)->where('score', '>=', 9)->count();
        $detractors = (clone $responses)->where('score', '<=', 6)->count();
        $passives = $total - $promoters - $detractors;

        $npsScore = $total > 0
            ? round((($promoters - $detractors) / $total) * 100, 1)
            : 0;

        // Trend by month
        $trend = DB::table('nps_responses')
            ->where('company_id', $tenantId)
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, AVG(score) as avg_score, COUNT(*) as total")
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        // By technician
        $byTech = DB::table('nps_responses')
            ->join('users', 'nps_responses.technician_id', '=', 'users.id')
            ->where('nps_responses.company_id', $tenantId)
            ->whereBetween('nps_responses.created_at', [$from, $to])
            ->selectRaw('users.name, AVG(nps_responses.score) as avg_score, COUNT(*) as total')
            ->groupBy('users.name')
            ->orderByDesc('avg_score')
            ->limit(10)
            ->get();

        return response()->json([
            'nps_score' => $npsScore,
            'avg_score' => $avgScore ? round($avgScore, 1) : null,
            'total_responses' => $total,
            'promoters' => $promoters,
            'passives' => $passives,
            'detractors' => $detractors,
            'trend' => $trend,
            'by_technician' => $byTech,
        ]);
    }

    // ─── Mapa de Calor de Chamados (#6) ─────────────────────────

    public function heatmapData(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $from = $request->input('from', now()->subMonths(6)->toDateString());
        $to = $request->input('to', now()->toDateString());

        $points = WorkOrder::where('company_id', $tenantId)
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->selectRaw('latitude, longitude, COUNT(*) as weight, tipo as type')
            ->groupBy('latitude', 'longitude', 'tipo')
            ->get()
            ->map(fn ($p) => [
                'lat' => (float) $p->latitude,
                'lng' => (float) $p->longitude,
                'weight' => $p->weight,
                'type' => $p->type,
            ]);

        // Regional summary
        $byCidade = WorkOrder::where('company_id', $tenantId)
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('cidade, estado, COUNT(*) as total')
            ->groupBy('cidade', 'estado')
            ->orderByDesc('total')
            ->limit(20)
            ->get();

        return response()->json([
            'heatmap' => $points,
            'by_city' => $byCidade,
            'total_points' => $points->count(),
        ]);
    }

    // ─── Produtividade do Técnico (#7) ──────────────────────────

    public function techProductivity(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $techId = $request->input('technician_id') ?? $request->user()->id;
        $from = $request->input('from');
        $to = $request->input('to');

        return response()->json($this->productivityService->getMetrics($techId, $tenantId, $from, $to));
    }

    public function techRanking(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        return response()->json($this->productivityService->getRanking(
            $tenantId,
            $request->input('from'),
            $request->input('to'),
            $request->input('limit', 20)
        ));
    }

    public function teamSummary(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        return response()->json($this->productivityService->getTeamSummary(
            $tenantId,
            $request->input('from'),
            $request->input('to')
        ));
    }

    // ─── Auto-Atribuição de OS (#8B) ────────────────────────────

    public function autoAssignRules(Request $request): JsonResponse
    {
        $rules = AutoAssignmentRule::where('company_id', $request->user()->company_id)
            ->orderBy('priority')
            ->paginate(20);

        return response()->json($rules);
    }

    public function storeAutoAssignRule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'entity_type' => 'required|string|in:work_order,service_call',
            'strategy' => 'required|string|in:round_robin,least_loaded,skill_match,proximity',
            'conditions' => 'nullable|array',
            'technician_ids' => 'nullable|array',
            'required_skills' => 'nullable|array',
            'priority' => 'nullable|integer|min:1|max:100',
            'is_active' => 'boolean',
        ]);

        $data['company_id'] = $request->user()->company_id;
        $rule = AutoAssignmentRule::create($data);

        return response()->json($rule, 201);
    }

    public function updateAutoAssignRule(Request $request, AutoAssignmentRule $rule): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'strategy' => 'sometimes|string|in:round_robin,least_loaded,skill_match,proximity',
            'conditions' => 'nullable|array',
            'technician_ids' => 'nullable|array',
            'required_skills' => 'nullable|array',
            'priority' => 'nullable|integer|min:1|max:100',
            'is_active' => 'boolean',
        ]);

        $rule->update($data);
        return response()->json($rule);
    }

    public function deleteAutoAssignRule(AutoAssignmentRule $rule): JsonResponse
    {
        $rule->delete();
        return response()->json(['message' => 'Rule deleted']);
    }

    public function triggerAutoAssign(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $technician = $this->autoAssignService->assignWorkOrder($workOrder);

        if ($technician) {
            return response()->json([
                'message' => "Auto-assigned to {$technician->name}",
                'technician' => $technician->only('id', 'name', 'email'),
            ]);
        }

        return response()->json(['message' => 'No matching technician found'], 404);
    }

    // ─── Helpers ────────────────────────────────────────────────

    private function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
