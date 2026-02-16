<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ScopesByRole;
use App\Models\CrmActivity;
use App\Models\Role;
use App\Models\CrmDeal;
use App\Models\CrmMessage;
use App\Models\CrmPipeline;
use App\Models\CrmPipelineStage;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\EquipmentDocument;
use App\Models\WorkOrder;
use App\Models\Quote;
use App\Models\ServiceCall;
use App\Models\FiscalNote;
use App\Models\EquipmentCalibration;
use Illuminate\Http\JsonResponse;
use App\Models\AccountReceivable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CrmController extends Controller
{
    use ScopesByRole;

    private function tenantId(Request $request): int
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }
    // ─── Dashboard ──────────────────────────────────────

    public function dashboard(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $openDeals = CrmDeal::where('tenant_id', $tenantId)->open()->count();
        $wonMonth = CrmDeal::where('tenant_id', $tenantId)->won()
            ->where('won_at', '>=', now()->startOfMonth())
            ->count();
        $lostMonth = CrmDeal::where('tenant_id', $tenantId)->lost()
            ->where('lost_at', '>=', now()->startOfMonth())
            ->count();

        $revenueInPipeline = CrmDeal::where('tenant_id', $tenantId)->open()
            ->selectRaw('SUM(value * probability / 100) as weighted_value')
            ->value('weighted_value') ?? 0;

        $wonRevenue = CrmDeal::where('tenant_id', $tenantId)->won()
            ->where('won_at', '>=', now()->startOfMonth())
            ->sum('value');

        $avgHealthScore = Customer::where('tenant_id', $tenantId)->where('is_active', true)
            ->where('health_score', '>', 0)
            ->avg('health_score') ?? 0;

        $noContact90 = Customer::where('tenant_id', $tenantId)->where('is_active', true)
            ->noContactSince(90)
            ->count();

        $conversionRate = 0;
        $totalClosed = $wonMonth + $lostMonth;
        if ($totalClosed > 0) {
            $conversionRate = round(($wonMonth / $totalClosed) * 100, 1);
        }

        // Funil por pipeline
        $pipelines = CrmPipeline::where('tenant_id', $tenantId)->active()
            ->with(['stages' => function ($q) {
                $q->withCount('deals')
                    ->withSum('deals', 'value')
                    ->orderBy('sort_order');
            }])
            ->orderBy('sort_order')
            ->get();

        // Deals recentes
        $recentDeals = CrmDeal::where('tenant_id', $tenantId)
            ->with(['customer:id,name', 'stage:id,name,color', 'pipeline:id,name'])
            ->orderByDesc('updated_at')
            ->take(10)
            ->get();

        // Atividades pendentes
        $upcomingActivities = CrmActivity::where('tenant_id', $tenantId)
            ->with(['customer:id,name', 'deal:id,title'])
            ->upcoming()
            ->take(10)
            ->get();

        // Top clientes por receita (deals ganhos)
        $topCustomers = CrmDeal::where('tenant_id', $tenantId)->won()
            ->select('customer_id', DB::raw('SUM(value) as total_value'), DB::raw('COUNT(*) as deal_count'))
            ->groupBy('customer_id')
            ->orderByDesc('total_value')
            ->take(10)
            ->with('customer:id,name')
            ->get();

        // Calibrações vencendo (integração)
        $calibrationAlerts = Equipment::where('tenant_id', $tenantId)->calibrationDue(60)
            ->active()
            ->with('customer:id,name')
            ->orderBy('next_calibration_at')
            ->take(10)
            ->get(['id', 'code', 'brand', 'model', 'customer_id', 'next_calibration_at']);

        // Messaging stats
        $msgThisMonth = CrmMessage::where('tenant_id', $tenantId)->where('created_at', '>=', now()->startOfMonth());
        $totalSent = (clone $msgThisMonth)->outbound()->count();
        $totalReceived = (clone $msgThisMonth)->inbound()->count();
        $whatsappSent = (clone $msgThisMonth)->outbound()->byChannel('whatsapp')->count();
        $emailSent = (clone $msgThisMonth)->outbound()->byChannel('email')->count();
        $delivered = (clone $msgThisMonth)->outbound()->whereIn('status', [CrmMessage::STATUS_DELIVERED, CrmMessage::STATUS_READ])->count();
        $failed = (clone $msgThisMonth)->outbound()->where('status', CrmMessage::STATUS_FAILED)->count();
        $deliveryRate = $totalSent > 0 ? round(($delivered / $totalSent) * 100, 1) : 0;

        return response()->json([
            'kpis' => [
                'open_deals' => $openDeals,
                'won_month' => $wonMonth,
                'lost_month' => $lostMonth,
                'revenue_in_pipeline' => (float) $revenueInPipeline,
                'won_revenue' => (float) $wonRevenue,
                'avg_health_score' => round($avgHealthScore),
                'no_contact_90d' => $noContact90,
                'conversion_rate' => $conversionRate,
            ],
            'messaging_stats' => [
                'sent_month' => $totalSent,
                'received_month' => $totalReceived,
                'whatsapp_sent' => $whatsappSent,
                'email_sent' => $emailSent,
                'delivered' => $delivered,
                'failed' => $failed,
                'delivery_rate' => $deliveryRate,
            ],
            'pipelines' => $pipelines,
            'recent_deals' => $recentDeals,
            'upcoming_activities' => $upcomingActivities,
            'top_customers' => $topCustomers,
            'calibration_alerts' => $calibrationAlerts,
        ]);
    }

    // ─── Pipelines ──────────────────────────────────────

    public function pipelinesIndex(): JsonResponse
    {
        $pipelines = CrmPipeline::active()
            ->with(['stages' => function ($q) {
                $q->orderBy('sort_order');
            }])
            ->orderBy('sort_order')
            ->get();

        return response()->json($pipelines);
    }

    public function pipelinesStore(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $userId = $request->user()->id;

        $data = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'required|string|max:50',
            'color' => 'nullable|string|max:20',
            'stages' => 'required|array|min:1',
            'stages.*.name' => 'required|string|max:100',
            'stages.*.color' => 'nullable|string|max:20',
            'stages.*.probability' => 'integer|min:0|max:100',
            'stages.*.is_won' => 'boolean',
            'stages.*.is_lost' => 'boolean',
        ]);

        DB::beginTransaction();
        try {
            $pipeline = CrmPipeline::create([
                'tenant_id' => $tenantId,
                'name' => $data['name'],
                'slug' => $data['slug'],
                'color' => $data['color'] ?? null,
            ]);

            foreach ($data['stages'] as $i => $stage) {
                $pipeline->stages()->create([
                    'tenant_id' => $tenantId,
                    'name' => $stage['name'],
                    'color' => $stage['color'] ?? null,
                    'sort_order' => $i,
                    'probability' => $stage['probability'] ?? 0,
                    'is_won' => $stage['is_won'] ?? false,
                    'is_lost' => $stage['is_lost'] ?? false,
                ]);
            }

            DB::commit();
            return response()->json($pipeline->load('stages'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar pipeline', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar pipeline'], 500);
        }
    }

    public function pipelinesUpdate(Request $request, CrmPipeline $pipeline): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'color' => 'nullable|string|max:20',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);

        $pipeline->update($data);
        return response()->json($pipeline->load('stages'));
    }

    public function pipelinesDestroy(CrmPipeline $pipeline): JsonResponse
    {
        $dealCount = CrmDeal::where('pipeline_id', $pipeline->id)->count();
        if ($dealCount > 0) {
            return response()->json([
                'message' => "Não é possível excluir pipeline com {$dealCount} deal(s) vinculado(s). Mova ou exclua os deals primeiro.",
            ], 422);
        }

        DB::beginTransaction();
        try {
            $pipeline->stages()->delete();
            $pipeline->delete();
            DB::commit();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao excluir pipeline', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir pipeline'], 500);
        }
    }

    // ─── Pipeline Stages ──────────────────────────────────

    public function stagesStore(Request $request, CrmPipeline $pipeline): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'color' => 'nullable|string|max:20',
            'probability' => 'integer|min:0|max:100',
            'is_won' => 'boolean',
            'is_lost' => 'boolean',
        ]);

        $data['tenant_id'] = $this->tenantId($request);
        $maxOrder = $pipeline->stages()->max('sort_order') ?? -1;
        $data['sort_order'] = $maxOrder + 1;

        $stage = $pipeline->stages()->create($data);
        return response()->json($stage, 201);
    }

    public function stagesUpdate(Request $request, CrmPipelineStage $stage): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'color' => 'nullable|string|max:20',
            'probability' => 'integer|min:0|max:100',
            'is_won' => 'boolean',
            'is_lost' => 'boolean',
        ]);

        $stage->update($data);
        return response()->json($stage);
    }

    public function stagesDestroy(CrmPipelineStage $stage): JsonResponse
    {
        $dealCount = $stage->deals()->count();
        if ($dealCount > 0) {
            return response()->json([
                'message' => "Não é possível excluir etapa com {$dealCount} deal(s). Mova os deals primeiro.",
            ], 422);
        }

        try {
            DB::transaction(fn () => $stage->delete());
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Erro ao excluir estágio', ['id' => $stage->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir estágio'], 500);
        }
    }

    public function stagesReorder(Request $request, CrmPipeline $pipeline): JsonResponse
    {
        $data = $request->validate([
            'stage_ids' => 'required|array',
            'stage_ids.*' => 'exists:crm_pipeline_stages,id',
        ]);

        foreach ($data['stage_ids'] as $i => $stageId) {
            CrmPipelineStage::where('id', $stageId)
                ->where('pipeline_id', $pipeline->id)
                ->update(['sort_order' => $i]);
        }

        return response()->json($pipeline->fresh()->load('stages'));
    }

    // ─── Deals ──────────────────────────────────────────

    public function dealsIndex(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $query = CrmDeal::with([
            'customer:id,name',
            'stage:id,name,color,sort_order',
            'pipeline:id,name',
            'assignee:id,name',
        ])->where('tenant_id', $tenantId);

        if ($this->shouldScopeByUser()) {
            $query->where('assigned_to', auth()->id());
        }

        if ($request->filled('pipeline_id')) {
            $query->byPipeline($request->pipeline_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        $deals = $query->orderByDesc('updated_at')->paginate($request->per_page ?? 50);
        return response()->json($deals);
    }

    public function dealsStore(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $data = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'pipeline_id' => ['required', Rule::exists('crm_pipelines', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'stage_id' => 'required|exists:crm_pipeline_stages,id',
            'title' => 'required|string|max:255',
            'value' => 'numeric|min:0',
            'probability' => 'integer|min:0|max:100',
            'expected_close_date' => 'nullable|date',
            'source' => 'nullable|string|max:50',
            'assigned_to' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'quote_id' => ['nullable', Rule::exists('quotes', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipment_id' => ['nullable', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'notes' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            $data['tenant_id'] = $tenantId;
            $data['status'] = CrmDeal::STATUS_OPEN;

            $deal = CrmDeal::create($data);

            Customer::where('id', $data['customer_id'])
                ->update(['last_contact_at' => now()]);

            DB::commit();

            return response()->json($deal->load([
                'customer:id,name', 'stage:id,name,color', 'pipeline:id,name',
            ]), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar deal', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar deal'], 500);
        }
    }

    public function dealsShow(CrmDeal $deal): JsonResponse
    {
        $deal->load([
            'customer:id,name,phone,email,health_score',
            'stage:id,name,color,probability',
            'pipeline:id,name',
            'assignee:id,name',
            'quote:id,quote_number,total,status',
            'workOrder:id,number,os_number,status,total',
            'equipment:id,code,brand,model',
            'activities' => fn($q) => $q->with('user:id,name')->orderByDesc('created_at')->take(20),
        ]);

        return response()->json($deal);
    }

    public function dealsUpdate(Request $request, CrmDeal $deal): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'value' => 'sometimes|numeric|min:0',
            'probability' => 'sometimes|integer|min:0|max:100',
            'expected_close_date' => 'nullable|date',
            'source' => 'nullable|string|max:50',
            'assigned_to' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'quote_id' => ['nullable', Rule::exists('quotes', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipment_id' => ['nullable', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'notes' => 'nullable|string',
        ]);

        $deal->update($data);
        return response()->json($deal->load([
            'customer:id,name', 'stage:id,name,color', 'pipeline:id,name',
        ]));
    }

    public function dealsUpdateStage(Request $request, CrmDeal $deal): JsonResponse
    {
        $data = $request->validate([
            'stage_id' => ['required', Rule::exists('crm_pipeline_stages', 'id')->where('pipeline_id', $deal->pipeline_id)],
        ]);

        DB::beginTransaction();
        try {
            $deal->moveToStage($data['stage_id']);

            CrmActivity::logSystemEvent(
                $deal->tenant_id,
                $deal->customer_id,
                "Deal movido para estágio: " . $deal->fresh()->stage->name,
                $deal->id
            );

            DB::commit();

            return response()->json($deal->fresh()->load([
                'customer:id,name', 'stage:id,name,color,sort_order', 'pipeline:id,name',
            ]));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao mover deal de estágio', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao mover deal de estágio'], 500);
        }
    }

    public function dealsMarkWon(Request $request, CrmDeal $deal): JsonResponse
    {
        if ($deal->status === CrmDeal::STATUS_WON) {
            return response()->json(['message' => 'Deal já está marcado como ganho'], 422);
        }

        DB::beginTransaction();
        try {
            $deal->markAsWon();

            CrmActivity::logSystemEvent(
                $deal->tenant_id,
                $deal->customer_id,
                "Deal ganho: {$deal->title} (R$ " . number_format((float) $deal->value, 2, ',', '.') . ")",
                $deal->id
            );

            Customer::where('id', $deal->customer_id)
                ->update(['last_contact_at' => now()]);

            DB::commit();

            return response()->json($deal->fresh()->load([
                'customer:id,name', 'stage:id,name,color', 'pipeline:id,name',
            ]));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao marcar deal como ganho', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao marcar deal como ganho'], 500);
        }
    }

    public function dealsMarkLost(Request $request, CrmDeal $deal): JsonResponse
    {
        if ($deal->status === CrmDeal::STATUS_LOST) {
            return response()->json(['message' => 'Deal já está marcado como perdido'], 422);
        }

        $data = $request->validate([
            'lost_reason' => 'nullable|string|max:500',
        ]);

        DB::beginTransaction();
        try {
            $deal->markAsLost($data['lost_reason'] ?? null);

            CrmActivity::logSystemEvent(
                $deal->tenant_id,
                $deal->customer_id,
                "Deal perdido: {$deal->title}" . (!empty($data['lost_reason']) ? " — Motivo: {$data['lost_reason']}" : ''),
                $deal->id
            );

            DB::commit();

            return response()->json($deal->fresh()->load([
                'customer:id,name', 'stage:id,name,color', 'pipeline:id,name',
            ]));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao marcar deal como perdido', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao marcar deal como perdido'], 500);
        }
    }

    public function dealsDestroy(CrmDeal $deal): JsonResponse
    {
        try {
            DB::transaction(function () use ($deal) {
                $deal->activities()->delete();
                $deal->delete();
            });
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Erro ao excluir deal', ['id' => $deal->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir deal'], 500);
        }
    }

    // ─── Activities ─────────────────────────────────────

    public function activitiesIndex(Request $request): JsonResponse
    {
        $query = CrmActivity::with(['customer:id,name', 'deal:id,title', 'user:id,name']);

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }
        if ($request->filled('deal_id')) {
            $query->where('deal_id', $request->deal_id);
        }
        if ($request->filled('type')) {
            $query->byType($request->type);
        }
        if ($request->filled('pending')) {
            $query->pending();
        }

        $activities = $query->orderByDesc('created_at')
            ->paginate($request->per_page ?? 30);

        return response()->json($activities);
    }

    public function activitiesStore(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(CrmActivity::TYPES))],
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'deal_id' => ['nullable', Rule::exists('crm_deals', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'scheduled_at' => 'nullable|date',
            'completed_at' => 'nullable|date',
            'duration_minutes' => 'nullable|integer|min:0',
            'outcome' => ['nullable', Rule::in(array_keys(CrmActivity::OUTCOMES))],
            'channel' => ['nullable', Rule::in(array_keys(CrmActivity::CHANNELS))],
            'metadata' => 'nullable|array',
        ]);

        DB::beginTransaction();
        try {
            $data['tenant_id'] = $tenantId;
            $data['user_id'] = $request->user()->id;

            $activity = CrmActivity::create($data);

            Customer::where('id', $data['customer_id'])
                ->update(['last_contact_at' => now()]);

            DB::commit();

            return response()->json($activity->load([
                'customer:id,name', 'deal:id,title', 'user:id,name',
            ]), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar atividade', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar atividade'], 500);
        }
    }

    public function activitiesUpdate(Request $request, CrmActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'type' => ['sometimes', Rule::in(array_keys(CrmActivity::TYPES))],
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'scheduled_at' => 'nullable|date',
            'completed_at' => 'nullable|date',
            'duration_minutes' => 'nullable|integer|min:0',
            'outcome' => ['nullable', Rule::in(array_keys(CrmActivity::OUTCOMES))],
            'channel' => ['nullable', Rule::in(array_keys(CrmActivity::CHANNELS))],
            'metadata' => 'nullable|array',
        ]);

        $activity->update($data);

        if (isset($data['completed_at'])) {
            Customer::where('id', $activity->customer_id)
                ->update(['last_contact_at' => now()]);
        }

        return response()->json($activity->load([
            'customer:id,name', 'deal:id,title', 'user:id,name',
        ]));
    }

    public function activitiesDestroy(CrmActivity $activity): JsonResponse
    {
        try {
            DB::transaction(fn () => $activity->delete());
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Erro ao excluir atividade', ['id' => $activity->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir atividade'], 500);
        }
    }

    // ─── Customer 360 ───────────────────────────────────

    public function customer360(Request $request, Customer $customer): JsonResponse
    {
        $customer->load([
            'contacts',
            'assignedSeller:id,name',
        ]);

        $tenantId = $customer->tenant_id;
        // Health score breakdown
        $healthBreakdown = $customer->health_score_breakdown;

        // Equipamentos
        $equipments = $customer->equipments()
            ->active()
            ->get(['id', 'code', 'brand', 'model', 'category', 'status', 'next_calibration_at', 'last_calibration_at']);

        // Deals
        $deals = $customer->deals()
            ->with(['stage:id,name,color', 'pipeline:id,name'])
            ->orderByDesc('updated_at')
            ->get();

        // Filtro por técnico (Regra de Negócio: Técnico só vê o que é dele)
        $user = $request->user();
        $isAdmin = $user->hasRole(Role::ADMIN) || $user->hasRole(Role::SUPER_ADMIN) || $user->hasPermission('platform.dashboard.view');

        // Timeline (Atividades CRM)
        $timeline = CrmActivity::where('customer_id', $customer->id)
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->take(30);

        if (!$isAdmin) {
             $timeline->where('user_id', $user->id);
        }
        $timeline = $timeline->get();

        // Orçamentos
        $quotesQuery = $customer->quotes()
            ->orderByDesc('created_at')
            ->take(10);
        
        if (!$isAdmin) {
            $quotesQuery->where('user_id', $user->id);
        }
        $quotes = $quotesQuery->get(['id', 'quote_number', 'status', 'total', 'created_at', 'approved_at']);

        // Ordens de Serviço
        $workOrdersQuery = $customer->workOrders()
            ->orderByDesc('created_at')
            ->take(10);
        
        if (!$isAdmin) {
            $workOrdersQuery->where(function($q) use ($user) {
                $q->where('technician_id', $user->id)
                  ->orWhere('user_id', $user->id);
            });
        }
        $workOrders = $workOrdersQuery->get(['id', 'number', 'os_number', 'status', 'total', 'created_at', 'completed_at']);

        // Financeiro - Receivables (todas as pendentes e recentes)
        $receivables = [];
        $pendingReceivablesSum = 0;

        if ($isAdmin || $user->hasPermission('finance.receivable.view')) {
            $receivables = $customer->accountsReceivable()
                ->with(['workOrder:id,number'])
                ->orderByDesc('due_date')
                ->take(50)
                ->get();

            $pendingReceivablesSum = $customer->accountsReceivable()
                ->whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_OVERDUE])
                ->sum('amount');
        }

        // Notas Fiscais
        $fiscalNotes = [];
        if ($isAdmin || $user->hasPermission('fiscal.note.view')) {
            $fiscalNotes = FiscalNote::where('customer_id', $customer->id)
                ->orderByDesc('created_at')
                ->take(20)
                ->get();
        }

        // Chamados
        $serviceCallsQuery = $customer->serviceCalls()
            ->orderByDesc('created_at')
            ->take(20);
        
        if (!$isAdmin) {
            $serviceCallsQuery->where('user_id', $user->id);
        }
        $serviceCalls = $serviceCallsQuery->get();

        // Documentos (certificados e documentos dos equipamentos do cliente)
        $equipmentIds = $customer->equipments()->pluck('id');
        $documents = EquipmentDocument::whereIn('equipment_id', $equipmentIds)
            ->with(['equipment:id,code,brand,model'])
            ->orderByDesc('created_at')
            ->get();

        // ─── Fase 2: Métricas de Inteligência ────────────────
        
        // 1. Health Metrics (Churn)
        $lastActivity = CrmActivity::where('customer_id', $customer->id)->latest()->first();
        $lastContactDays = $lastActivity ? now()->diffInDays($lastActivity->created_at) : 999;
        $churnRisk = $lastContactDays > 150 ? 'crítico' : ($lastContactDays > 90 ? 'alto' : ($lastContactDays > 45 ? 'médio' : 'baixo'));

        // 2. Commercial Metrics (LTV & Conversão)
        $wonQuotesSum = $customer->quotes()->where('status', 'Aprovado')->sum('total');
        $paidOsSum = $customer->workOrders()->where('status', 'Concluído')->sum('total');
        $ltv = (float)$wonQuotesSum + (float)$paidOsSum;

        $totalQuotesCount = $customer->quotes()->count();
        $approvedQuotesCount = $customer->quotes()->where('status', 'Aprovado')->count();
        $conversionRate = $totalQuotesCount > 0 ? round(($approvedQuotesCount / $totalQuotesCount) * 100, 1) : 0;

        // 3. Forecast de Calibrações (Próximos 6 meses)
        $forecast = [];
        for ($i = 0; $i < 6; $i++) {
            $monthDate = now()->addMonths($i);
            $count = $customer->equipments()
                ->where('next_calibration_at', '>=', $monthDate->startOfMonth()->toDateString())
                ->where('next_calibration_at', '<=', $monthDate->endOfMonth()->toDateString())
                ->count();
            
            $forecast[] = [
                'name' => $monthDate->translatedFormat('M/y'),
                'count' => $count
            ];
        }

        // 4. Trend Data (Tendência do Equipamento Principal)
        $mainEquipment = $customer->equipments()->withCount('calibrations')->orderByDesc('calibrations_count')->first();
        $trendData = [];
        if ($mainEquipment) {
            $trendData = EquipmentCalibration::where('equipment_id', $mainEquipment->id)
                ->orderBy('calibration_date')
                ->take(10)
                ->get()
                ->map(fn($c) => [
                    'date' => $c->calibration_date instanceof \DateTimeInterface ? $c->calibration_date->format('d/m/y') : ($c->calibration_date ? date('d/m/y', strtotime($c->calibration_date)) : 'N/A'),
                    'error' => (float)($c->error_found ?? 0),
                    'uncertainty' => (float)($c->uncertainty ?? 0)
                ]);
        }

        // 5. Radar de Saúde (Holístico)
        $financeScore = $pendingReceivablesSum > 0 ? 50 : 100;
        $engagementScore = max(0, 100 - ($lastContactDays / 1.5));
        $metrologyScore = $customer->equipments()->count() > 0 
            ? ($customer->equipments()->where('calibration_status', 'em_dia')->count() / $customer->equipments()->count() * 100)
            : 100;

        $radarData = [
            ['subject' => 'Financeiro', 'value' => $financeScore],
            ['subject' => 'Comercial', 'value' => $conversionRate],
            ['subject' => 'Engajamento', 'value' => $engagementScore],
            ['subject' => 'Metrologia', 'value' => $metrologyScore],
            ['subject' => 'Lealdade', 'value' => $customer->is_active ? 100 : 0],
        ];

        // 6. Benchmarking (Segmento)
        $segmentAvgRevenue = Customer::where('tenant_id', $tenantId)
            ->where('segment', $customer->segment)
            ->where('id', '!=', $customer->id)
            ->withSum('workOrders', 'total')
            ->get()
            ->avg('work_orders_sum_total') ?? 0;

        // 7. Automação de Retenção (CRM Proativo)
        if (in_array($churnRisk, ['crítico', 'alto'])) {
            $hasOpenFollowUp = CrmActivity::where('customer_id', $customer->id)
                ->where('type', 'call')
                ->where('status', 'pending')
                ->where('title', 'LIKE', '%Retenção%')
                ->exists();

            if (!$hasOpenFollowUp) {
                CrmActivity::create([
                    'tenant_id' => $tenantId,
                    'customer_id' => $customer->id,
                    'assigned_to' => $customer->assigned_seller_id ?? $request->user()->id,
                    'title' => '🚨 Retenção: Cliente com Risco de Churn ' . ucfirst($churnRisk),
                    'description' => "Automação: O sistema detectou risco de perda devido à inatividade de {$lastContactDays} dias. Favor entrar em contato.",
                    'type' => 'call',
                    'priority' => 'high',
                    'status' => 'pending',
                    'due_date' => now()->addDays(2),
                ]);
            }
        }

        return response()->json([
            'customer' => $customer,
            'health_breakdown' => $healthBreakdown,
            'equipments' => $equipments,
            'deals' => $deals,
            'timeline' => $timeline,
            'work_orders' => $workOrders,
            'service_calls' => $serviceCalls,
            'quotes' => $quotes,
            'receivables' => $receivables,
            'pending_receivables' => (float) $pendingReceivablesSum,
            'fiscal_notes' => $fiscalNotes,
            'documents' => $documents,
            'metrics' => [
                'churn_risk' => $churnRisk,
                'last_contact_days' => $lastContactDays,
                'ltv' => $ltv,
                'conversion_rate' => $conversionRate,
                'forecast' => $forecast,
                'trend' => $trendData,
                'radar' => $radarData,
                'benchmarking' => [
                    ['name' => 'Este Cliente', 'value' => (float)$paidOsSum],
                    ['name' => 'Média do Segmento', 'value' => (float)$segmentAvgRevenue]
                ],
                'main_equipment_name' => $mainEquipment ? ($mainEquipment->brand . ' ' . $mainEquipment->model) : null
            ]
        ]);
    }

    public function export360($id)
    {
        $data = $this->customer360(new \Illuminate\Http\Request(['id' => $id]), $id);
        
        if ($data->getStatusCode() !== 200) return $data;

        $content = $data->getData(true);
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdfs.customer-360', $content)
            ->setPaper('a4', 'portrait');

        return $pdf->download("Universo_Cliente_{$id}.pdf");
    }

    // ─── Constants ──────────────────────────────────────

    public function constants(): JsonResponse
    {
        return response()->json([
            'deal_statuses' => CrmDeal::STATUSES,
            'deal_sources' => CrmDeal::SOURCES,
            'activity_types' => CrmActivity::TYPES,
            'activity_outcomes' => CrmActivity::OUTCOMES,
            'activity_channels' => CrmActivity::CHANNELS,
            'customer_sources' => Customer::SOURCES,
            'customer_segments' => Customer::SEGMENTS,
            'customer_sizes' => Customer::COMPANY_SIZES,
            'customer_contract_types' => Customer::CONTRACT_TYPES,
            'customer_ratings' => Customer::RATINGS,
        ]);
    }
}
