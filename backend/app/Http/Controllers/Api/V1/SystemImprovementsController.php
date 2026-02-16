<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ScopesByRole;
use App\Models\AccountReceivable;
use App\Models\CapaRecord;
use App\Models\CollectionActionLog;
use App\Models\CollectionRule;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Product;
use App\Models\SearchIndex;
use App\Models\TechnicianSkill;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SystemImprovementsController extends Controller
{
    use ScopesByRole;

    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════
    // TÉCNICOS: SKILL MATRIX
    // ═══════════════════════════════════════════════════════

    public function technicianSkills(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $userId = $request->input('user_id');

        $skills = TechnicianSkill::where('tenant_id', $tenantId)
            ->with('user:id,name')
            ->when($userId, fn($q, $id) => $q->where('user_id', $id))
            ->orderBy('user_id')
            ->orderBy('category')
            ->get();

        return response()->json($skills);
    }

    public function storeTechnicianSkill(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'skill_name' => 'required|string|max:255',
            'category' => ['required', Rule::in(array_keys(TechnicianSkill::CATEGORIES))],
            'proficiency_level' => 'required|integer|min:1|max:5',
            'certification' => 'nullable|string',
            'certified_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
        ]);

        $skill = TechnicianSkill::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
        ]);

        return response()->json($skill, 201);
    }

    public function updateTechnicianSkill(Request $request, TechnicianSkill $skill): JsonResponse
    {
        $skill->update($request->validate([
            'proficiency_level' => 'integer|min:1|max:5',
            'certification' => 'nullable|string',
            'certified_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
        ]));

        return response()->json($skill);
    }

    public function destroyTechnicianSkill(TechnicianSkill $skill): JsonResponse
    {
        $skill->delete();
        return response()->json(['message' => 'Habilidade removida']);
    }

    public function skillMatrix(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $technicians = User::where('tenant_id', $tenantId)
            ->whereHas('roles', fn($q) => $q->whereIn('name', ['tecnico', 'tecnico_vendedor']))
            ->with(['technicianSkills' => fn($q) => $q->orderBy('category')])
            ->get()
            ->map(fn($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'skills' => $user->technicianSkills,
                'skill_count' => $user->technicianSkills->count(),
                'avg_proficiency' => round($user->technicianSkills->avg('proficiency_level') ?? 0, 1),
                'expiring_certs' => $user->technicianSkills->filter(fn($s) =>
                    $s->expires_at && $s->expires_at->lte(now()->addDays(60))
                )->count(),
            ]);

        return response()->json($technicians);
    }

    public function recommendTechnician(Request $request): JsonResponse
    {
        $data = $request->validate([
            'equipment_type' => 'nullable|string',
            'brand' => 'nullable|string',
            'service_type' => 'nullable|string',
        ]);

        $tenantId = $this->tenantId($request);

        $query = TechnicianSkill::where('tenant_id', $tenantId);

        if (!empty($data['equipment_type'])) {
            $query->where(function ($q) use ($data) {
                $q->where('skill_name', 'like', "%{$data['equipment_type']}%")
                    ->where('category', 'equipment_type');
            });
        }

        if (!empty($data['brand'])) {
            $query->orWhere(function ($q) use ($data, $tenantId) {
                $q->where('tenant_id', $tenantId)
                    ->where('skill_name', 'like', "%{$data['brand']}%")
                    ->where('category', 'brand');
            });
        }

        $recommendations = $query->with('user:id,name')
            ->orderByDesc('proficiency_level')
            ->get()
            ->groupBy('user_id')
            ->map(fn($skills, $userId) => [
                'user' => $skills->first()->user,
                'matching_skills' => $skills->count(),
                'avg_proficiency' => round($skills->avg('proficiency_level'), 1),
                'skills' => $skills->pluck('skill_name'),
            ])
            ->sortByDesc('avg_proficiency')
            ->values();

        return response()->json($recommendations);
    }

    // ═══════════════════════════════════════════════════════
    // FINANCEIRO: RÉGUA DE COBRANÇA
    // ═══════════════════════════════════════════════════════

    public function collectionRules(Request $request): JsonResponse
    {
        $rules = CollectionRule::where('tenant_id', $this->tenantId($request))
            ->orderBy('days_offset')
            ->get();

        return response()->json($rules);
    }

    public function storeCollectionRule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'days_offset' => 'required|integer',
            'channel' => ['required', Rule::in(CollectionRule::CHANNELS)],
            'template_type' => [Rule::in(array_keys(CollectionRule::TEMPLATE_TYPES))],
            'message_body' => 'nullable|string',
        ]);

        $rule = CollectionRule::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
        ]);

        return response()->json($rule, 201);
    }

    public function updateCollectionRule(Request $request, CollectionRule $rule): JsonResponse
    {
        $rule->update($request->validate([
            'name' => 'string|max:255',
            'days_offset' => 'integer',
            'channel' => [Rule::in(CollectionRule::CHANNELS)],
            'template_type' => [Rule::in(array_keys(CollectionRule::TEMPLATE_TYPES))],
            'message_body' => 'nullable|string',
            'is_active' => 'boolean',
        ]));

        return response()->json($rule);
    }

    public function destroyCollectionRule(CollectionRule $rule): JsonResponse
    {
        $rule->delete();
        return response()->json(['message' => 'Regra removida']);
    }

    public function agingReport(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $aging = AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', 'overdue')
            ->get()
            ->groupBy(function ($ar) {
                $days = now()->diffInDays($ar->due_date);
                if ($days <= 30) return '0-30';
                if ($days <= 60) return '31-60';
                if ($days <= 90) return '61-90';
                return '90+';
            })
            ->map(fn($group, $range) => [
                'range' => $range,
                'count' => $group->count(),
                'total_value' => $group->sum('amount'),
                'customers' => $group->groupBy('customer_id')->count(),
            ]);

        $totalOverdue = AccountReceivable::where('tenant_id', $tenantId)
            ->where('status', 'overdue')
            ->sum('amount');

        return response()->json([
            'aging' => $aging,
            'total_overdue' => $totalOverdue,
            'total_customers' => AccountReceivable::where('tenant_id', $tenantId)
                ->where('status', 'overdue')
                ->distinct('customer_id')
                ->count('customer_id'),
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // ESTOQUE: PREVISÃO DE DEMANDA
    // ═══════════════════════════════════════════════════════

    public function stockDemandForecast(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $days = $request->input('days', 30);

        // Products used in upcoming work orders
        $upcomingDemand = DB::table('work_order_items')
            ->join('work_orders', 'work_order_items.work_order_id', '=', 'work_orders.id')
            ->where('work_orders.tenant_id', $tenantId)
            ->whereIn('work_orders.status', ['scheduled', 'in_progress', 'pending'])
            ->where('work_order_items.product_id', '!=', null)
            ->select(
                'work_order_items.product_id',
                DB::raw('SUM(work_order_items.quantity) as needed_quantity'),
                DB::raw('COUNT(DISTINCT work_orders.id) as os_count')
            )
            ->groupBy('work_order_items.product_id')
            ->get();

        $forecast = $upcomingDemand->map(function ($item) use ($tenantId) {
            $product = Product::find($item->product_id);
            $currentStock = DB::table('warehouse_stocks')
                ->where('product_id', $item->product_id)
                ->sum('quantity');

            $deficit = max(0, $item->needed_quantity - $currentStock);

            return [
                'product_id' => $item->product_id,
                'product_name' => $product?->name ?? 'N/A',
                'product_code' => $product?->code ?? 'N/A',
                'needed_quantity' => $item->needed_quantity,
                'current_stock' => $currentStock,
                'deficit' => $deficit,
                'os_count' => $item->os_count,
                'status' => $deficit > 0 ? 'critical' : ($currentStock < $item->needed_quantity * 1.5 ? 'warning' : 'ok'),
            ];
        })->sortByDesc('deficit')->values();

        return response()->json($forecast);
    }

    // ═══════════════════════════════════════════════════════
    // QUALIDADE: CAPA (AÇÕES CORRETIVAS/PREVENTIVAS)
    // ═══════════════════════════════════════════════════════

    public function capaRecords(Request $request): JsonResponse
    {
        $records = CapaRecord::where('tenant_id', $this->tenantId($request))
            ->with(['assignee:id,name', 'creator:id,name'])
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->when($request->input('type'), fn($q, $t) => $q->where('type', $t))
            ->when($request->input('source'), fn($q, $s) => $q->where('source', $s))
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 20));

        return response()->json($records);
    }

    public function storeCapaRecord(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(CapaRecord::TYPES))],
            'source' => ['required', Rule::in(array_keys(CapaRecord::SOURCES))],
            'source_id' => 'nullable|integer',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'assigned_to' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
        ]);

        $record = CapaRecord::create([
            ...$data,
            'tenant_id' => $this->tenantId($request),
            'created_by' => $request->user()->id,
        ]);

        return response()->json($record, 201);
    }

    public function updateCapaRecord(Request $request, CapaRecord $record): JsonResponse
    {
        $data = $request->validate([
            'status' => [Rule::in(array_keys(CapaRecord::STATUSES))],
            'root_cause' => 'nullable|string',
            'corrective_action' => 'nullable|string',
            'preventive_action' => 'nullable|string',
            'verification' => 'nullable|string',
            'effectiveness' => [Rule::in(array_keys(CapaRecord::EFFECTIVENESS))],
            'assigned_to' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
        ]);

        $record->update($data);

        if (($data['status'] ?? null) === 'closed') {
            $record->update(['closed_at' => now()]);
        }

        return response()->json($record);
    }

    public function qualityDashboard(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $openCapas = CapaRecord::where('tenant_id', $tenantId)->open()->count();
        $overdueCapas = CapaRecord::where('tenant_id', $tenantId)->open()
            ->where('due_date', '<', now())->count();

        $reworkRate = 0;
        $totalOs = WorkOrder::where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subMonths(3))->count();

        if ($totalOs > 0) {
            $reworks = WorkOrder::where('tenant_id', $tenantId)
                ->where('created_at', '>=', now()->subMonths(3))
                ->where('notes', 'like', '%retrabho%')
                ->orWhere('notes', 'like', '%retrabalho%')
                ->count();
            $reworkRate = round(($reworks / $totalOs) * 100, 1);
        }

        $complaintCount = DB::table('complaints')
            ->where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subMonth())
            ->count();

        $avgResolutionDays = CapaRecord::where('tenant_id', $tenantId)
            ->whereNotNull('closed_at')
            ->where('closed_at', '>=', now()->subMonths(6))
            ->get()
            ->avg(fn($r) => $r->created_at->diffInDays($r->closed_at));

        $npsScore = 0;
        $npsData = DB::table('nps_responses')
            ->where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subMonths(3))
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN score >= 9 THEN 1 ELSE 0 END) as promoters,
                SUM(CASE WHEN score <= 6 THEN 1 ELSE 0 END) as detractors
            ")
            ->first();

        if ($npsData && $npsData->total > 0) {
            $npsScore = round((($npsData->promoters - $npsData->detractors) / $npsData->total) * 100);
        }

        return response()->json([
            'open_capas' => $openCapas,
            'overdue_capas' => $overdueCapas,
            'rework_rate' => $reworkRate,
            'complaints_month' => $complaintCount,
            'avg_resolution_days' => round($avgResolutionDays ?? 0, 1),
            'nps_score' => $npsScore,
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // BUSCA GLOBAL
    // ═══════════════════════════════════════════════════════

    public function globalSearch(Request $request): JsonResponse
    {
        $query = $request->input('q');
        if (!$query || strlen($query) < 2) {
            return response()->json([]);
        }

        $tenantId = $this->tenantId($request);
        $limit = $request->input('limit', 20);

        $results = collect();

        // Search customers
        $customers = Customer::where('tenant_id', $tenantId)
            ->where(function ($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                    ->orWhere('email', 'like', "%{$query}%")
                    ->orWhere('document', 'like', "%{$query}%")
                    ->orWhere('phone', 'like', "%{$query}%");
            })
            ->limit(5)
            ->get()
            ->map(fn($c) => [
                'type' => 'customer',
                'id' => $c->id,
                'title' => $c->name,
                'subtitle' => $c->email ?? $c->phone,
                'url' => "/cadastros/clientes/{$c->id}",
                'module' => 'Clientes',
            ]);
        $results = $results->merge($customers);

        // Search work orders
        $workOrders = WorkOrder::where('tenant_id', $tenantId)
            ->where(function ($q) use ($query) {
                $q->where('number', 'like', "%{$query}%")
                    ->orWhere('os_number', 'like', "%{$query}%")
                    ->orWhere('business_number', 'like', "%{$query}%");
            })
            ->limit(5)
            ->get()
            ->map(fn($wo) => [
                'type' => 'work_order',
                'id' => $wo->id,
                'title' => "OS #{$wo->number}",
                'subtitle' => $wo->status,
                'url' => "/os/{$wo->id}",
                'module' => 'Ordens de Serviço',
            ]);
        $results = $results->merge($workOrders);

        // Search quotes
        $quotes = DB::table('quotes')
            ->where('tenant_id', $tenantId)
            ->where('quote_number', 'like', "%{$query}%")
            ->limit(5)
            ->get()
            ->map(fn($q) => [
                'type' => 'quote',
                'id' => $q->id,
                'title' => "Orçamento #{$q->quote_number}",
                'subtitle' => $q->status,
                'url' => "/orcamentos/{$q->id}",
                'module' => 'Orçamentos',
            ]);
        $results = $results->merge($quotes);

        // Search equipments
        $equipments = Equipment::where('tenant_id', $tenantId)
            ->where(function ($q) use ($query) {
                $q->where('code', 'like', "%{$query}%")
                    ->orWhere('brand', 'like', "%{$query}%")
                    ->orWhere('model', 'like', "%{$query}%")
                    ->orWhere('serial_number', 'like', "%{$query}%");
            })
            ->limit(5)
            ->get()
            ->map(fn($e) => [
                'type' => 'equipment',
                'id' => $e->id,
                'title' => "{$e->code} - {$e->brand} {$e->model}",
                'subtitle' => $e->serial_number,
                'url' => "/equipamentos/{$e->id}",
                'module' => 'Equipamentos',
            ]);
        $results = $results->merge($equipments);

        // Search deals
        $deals = DB::table('crm_deals')
            ->where('tenant_id', $tenantId)
            ->where('title', 'like', "%{$query}%")
            ->limit(5)
            ->get()
            ->map(fn($d) => [
                'type' => 'deal',
                'id' => $d->id,
                'title' => $d->title,
                'subtitle' => "R$ " . number_format($d->value, 2, ',', '.'),
                'url' => "/crm/pipeline",
                'module' => 'CRM',
            ]);
        $results = $results->merge($deals);

        return response()->json($results->take($limit)->values());
    }

    // ═══════════════════════════════════════════════════════
    // OS: ESTIMATIVA DE CUSTO EM TEMPO REAL
    // ═══════════════════════════════════════════════════════

    public function workOrderCostEstimate(Request $request, int $workOrderId): JsonResponse
    {
        $wo = WorkOrder::where('tenant_id', $this->tenantId($request))
            ->with(['items', 'timeEntries'])
            ->findOrFail($workOrderId);

        $partsTotal = $wo->items->sum(fn($i) => ($i->unit_price ?? 0) * ($i->quantity ?? 0));

        $laborHours = $wo->timeEntries->sum('duration_minutes') / 60;
        $avgHourlyRate = 120; // default, could be from settings
        $laborCost = $laborHours * $avgHourlyRate;

        $displacementCost = 50; // default km cost

        $totalCost = $partsTotal + $laborCost + $displacementCost;
        $revenue = $wo->total ?? 0;
        $margin = $revenue > 0 ? round((($revenue - $totalCost) / $revenue) * 100, 1) : 0;

        return response()->json([
            'parts_cost' => round($partsTotal, 2),
            'labor_hours' => round($laborHours, 1),
            'labor_cost' => round($laborCost, 2),
            'displacement_cost' => round($displacementCost, 2),
            'total_cost' => round($totalCost, 2),
            'revenue' => round($revenue, 2),
            'margin_percent' => $margin,
            'is_profitable' => $margin > 0,
        ]);
    }
}
