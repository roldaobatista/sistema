<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ScopesByRole;
use App\Http\Requests\ServiceCall\StoreServiceCallRequest;
use App\Http\Requests\ServiceCall\UpdateServiceCallRequest;
use App\Models\AuditLog;
use App\Models\ServiceCall;
use App\Models\ServiceCallComment;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class ServiceCallController extends Controller
{
    use ScopesByRole;

    private function currentTenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    private function slaBreachCondition(string $endExpr = 'NOW()'): string
    {
        $driver = DB::getDriverName();
        $slaCase = "CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 8 WHEN 'normal' THEN 24 WHEN 'low' THEN 48 ELSE 24 END";

        if ($driver === 'sqlite') {
            return "(julianday(COALESCE({$endExpr}, datetime('now'))) - julianday(created_at)) * 24 > {$slaCase}";
        }

        return "TIMESTAMPDIFF(HOUR, created_at, COALESCE({$endExpr}, NOW())) > {$slaCase}";
    }

    private function canAssignTechnician(): bool
    {
        $user = auth()->user();
        if (!$user) {
            return false;
        }

        return $user->hasRole(Role::SUPER_ADMIN) || $user->can('service_calls.service_call.assign');
    }

    private function requestTouchesAssignmentFields(Request $request): bool
    {
        return $request->exists('technician_id')
            || $request->exists('driver_id')
            || $request->exists('scheduled_date');
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $query = ServiceCall::with(['customer:id,name', 'technician:id,name', 'driver:id,name'])
            ->withCount('equipments')
            ->where('tenant_id', $tenantId);

        if ($request->get('my')) {
            $userId = auth()->id();
            $query->where(function ($q) use ($userId) {
                $q->where('technician_id', $userId)
                    ->orWhere('driver_id', $userId)
                    ->orWhere('created_by', $userId);
            });
        } elseif ($this->shouldScopeByUser()) {
            $userId = auth()->id();
            $query->where(function ($q) use ($userId) {
                $q->where('technician_id', $userId)
                    ->orWhere('driver_id', $userId)
                    ->orWhere('created_by', $userId);
            });
        }

        if ($s = $request->get('search')) {
            $query->where(function ($q) use ($s) {
                $q->where('call_number', 'like', "%$s%")
                    ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%$s%"));
            });
        }
        if ($status = $request->get('status')) $query->where('status', $status);
        if ($techId = $request->get('technician_id')) $query->where('technician_id', $techId);
        if ($priority = $request->get('priority')) $query->where('priority', $priority);
        if ($dateFrom = $request->get('date_from')) $query->where('created_at', '>=', $dateFrom);
        if ($dateTo = $request->get('date_to')) $query->where('created_at', '<=', $dateTo . ' 23:59:59');

        return response()->json($query->orderByDesc('created_at')->paginate($request->get('per_page', 30)));
    }

    public function store(StoreServiceCallRequest $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        if ($this->requestTouchesAssignmentFields($request) && !$this->canAssignTechnician()) {
            return response()->json([
                'message' => 'Sem permissão para atribuir técnico/agenda no chamado.',
            ], 403);
        }

        $validated = $request->validated();

        $equipmentIds = $validated['equipment_ids'] ?? [];
        unset($validated['equipment_ids']);
        // Prevent status override — always start as open
        unset($validated['status']);

        try {
            $call = DB::transaction(function () use ($validated, $tenantId, $request, $equipmentIds) {
                $call = ServiceCall::create([
                    ...$validated,
                    'tenant_id' => $tenantId,
                    'created_by' => $request->user()->id,
                    'call_number' => ServiceCall::nextNumber($tenantId),
                    'status' => ServiceCall::STATUS_OPEN,
                ]);

                if (!empty($equipmentIds)) {
                    $call->equipments()->attach($equipmentIds);
                }

                AuditLog::log('created', "Chamado {$call->call_number} criado", $call);

                return $call;
            });

            event(new \App\Events\ServiceCallCreated($call, auth()->user()));

            return response()->json($call->load(['customer', 'technician', 'driver', 'equipments']), 201);
        } catch (\Throwable $e) {
            Log::error('ServiceCall create failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao criar chamado'], 500);
        }
    }

    public function show(ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        return response()->json($serviceCall->load([
            'customer.contacts', 'quote', 'technician:id,name', 'driver:id,name',
            'createdBy:id,name', 'equipments', 'comments.user:id,name',
        ]));
    }

    public function update(UpdateServiceCallRequest $request, ServiceCall $serviceCall): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        if ((int) $serviceCall->tenant_id !== $tenantId) {
            abort(403);
        }

        if ($this->requestTouchesAssignmentFields($request) && !$this->canAssignTechnician()) {
            return response()->json([
                'message' => 'Sem permissão para atribuir técnico/agenda no chamado.',
            ], 403);
        }

        $validated = $request->validated();

        $equipmentIds = $validated['equipment_ids'] ?? null;
        unset($validated['equipment_ids']);
        // Prevent status override via update
        unset($validated['status']);

        try {
            DB::transaction(function () use ($serviceCall, $validated, $equipmentIds) {
                $serviceCall->update($validated);

                if ($equipmentIds !== null) {
                    $serviceCall->equipments()->sync($equipmentIds);
                }

                AuditLog::log('updated', "Chamado {$serviceCall->call_number} atualizado", $serviceCall);
            });

            return response()->json($serviceCall->fresh(['customer', 'technician', 'driver', 'equipments']));
        } catch (\Throwable $e) {
            Log::error('ServiceCall update failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao atualizar chamado'], 500);
        }
    }

    public function destroy(ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        $hasWorkOrder = WorkOrder::where('service_call_id', $serviceCall->id)->exists();
        if ($hasWorkOrder) {
            return response()->json([
                'message' => 'Não é possível excluir — chamado possui OS vinculada',
            ], 409);
        }

        try {
            DB::transaction(function () use ($serviceCall) {
                $serviceCall->delete();
                AuditLog::log('deleted', "Chamado {$serviceCall->call_number} excluído", $serviceCall);
            });

            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('ServiceCall delete failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao excluir chamado'], 500);
        }
    }

    // ── Ações de Negócio ──

    public function updateStatus(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(array_keys(ServiceCall::STATUSES))],
            'resolution_notes' => 'nullable|string',
        ]);

        if (!$serviceCall->canTransitionTo($validated['status'])) {
            return response()->json([
                'message' => 'Transição de status não permitida: ' . $serviceCall->status . ' → ' . $validated['status'],
                'allowed_transitions' => ServiceCall::ALLOWED_TRANSITIONS[$serviceCall->status] ?? [],
            ], 422);
        }

        // Impedir avanço para 'scheduled' sem técnico atribuído
        if ($validated['status'] === ServiceCall::STATUS_SCHEDULED && !$serviceCall->technician_id) {
            return response()->json([
                'message' => 'Não é possível agendar um chamado sem técnico atribuído.',
            ], 422);
        }

        try {
            $old = $serviceCall->status;

            DB::transaction(function () use ($serviceCall, $validated, $old) {
                $updateData = [
                    'status' => $validated['status'],
                ];

                if ($validated['status'] === ServiceCall::STATUS_IN_PROGRESS && !$serviceCall->started_at) {
                    $updateData['started_at'] = now();
                }
                if ($validated['status'] === ServiceCall::STATUS_COMPLETED) {
                    $updateData['completed_at'] = now();
                    if (!empty($validated['resolution_notes'])) {
                        $updateData['resolution_notes'] = $validated['resolution_notes'];
                    }
                }
                // Ao reabrir chamado, limpar timestamps
                if ($validated['status'] === ServiceCall::STATUS_OPEN) {
                    $updateData['started_at'] = null;
                    $updateData['completed_at'] = null;
                }
                // Tracking de reagendamento (voltou para scheduled de outro estado)
                if ($validated['status'] === ServiceCall::STATUS_SCHEDULED && $old !== ServiceCall::STATUS_OPEN) {
                    $updateData['reschedule_count'] = ($serviceCall->reschedule_count ?? 0) + 1;
                    $updateData['reschedule_reason'] = $validated['resolution_notes'] ?? null;
                }

                $serviceCall->update($updateData);

                AuditLog::log('status_changed', "Chamado {$serviceCall->call_number}: $old → {$validated['status']}", $serviceCall);
            });

            event(new \App\Events\ServiceCallStatusChanged($serviceCall, $old, $validated['status'], auth()->user()));

            return response()->json($serviceCall->fresh());
        } catch (\Throwable $e) {
            Log::error('ServiceCall status update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar status'], 500);
        }
    }

    public function assignTechnician(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        if ((int) $serviceCall->tenant_id !== $tenantId) {
            abort(403);
        }

        $validated = $request->validate([
            'technician_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('is_active', true)->where(fn ($sub) => $sub->where('tenant_id', $tenantId)->orWhere('current_tenant_id', $tenantId)))],
            'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('is_active', true)->where(fn ($sub) => $sub->where('tenant_id', $tenantId)->orWhere('current_tenant_id', $tenantId)))],
            'scheduled_date' => 'nullable|date',
        ]);

        try {
            DB::transaction(function () use ($serviceCall, $validated) {
                $newStatus = $serviceCall->status;
                $hasScheduledDate = !empty($validated['scheduled_date']);

                if ($serviceCall->status === ServiceCall::STATUS_OPEN
                    && $hasScheduledDate
                    && $serviceCall->canTransitionTo(ServiceCall::STATUS_SCHEDULED)) {
                    $newStatus = ServiceCall::STATUS_SCHEDULED;
                }

                $serviceCall->update([
                    ...$validated,
                    'status' => $newStatus,
                ]);

                AuditLog::log('updated', "Técnico atribuído ao chamado {$serviceCall->call_number}", $serviceCall);
            });

            return response()->json($serviceCall->fresh(['technician', 'driver']));
        } catch (\Throwable $e) {
            Log::error('ServiceCall assign failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atribuir técnico'], 500);
        }
    }

    public function convertToWorkOrder(ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        if (!in_array($serviceCall->status, [ServiceCall::STATUS_COMPLETED, ServiceCall::STATUS_IN_PROGRESS])) {
            return response()->json(['message' => 'Chamado precisa estar em atendimento ou concluido'], 422);
        }

        $existingWorkOrder = WorkOrder::query()
            ->where('tenant_id', $serviceCall->tenant_id)
            ->where('service_call_id', $serviceCall->id)
            ->first();

        if ($existingWorkOrder) {
            return response()->json([
                'message' => 'Este chamado ja foi convertido em OS',
                'work_order' => [
                    'id' => $existingWorkOrder->id,
                    'number' => $existingWorkOrder->number,
                    'os_number' => $existingWorkOrder->os_number,
                    'business_number' => $existingWorkOrder->business_number,
                    'status' => $existingWorkOrder->status,
                ],
            ], 409);
        }

        try {
            $wo = DB::transaction(function () use ($serviceCall) {
                $wo = WorkOrder::create([
                    'tenant_id' => $serviceCall->tenant_id,
                    'number' => WorkOrder::nextNumber($serviceCall->tenant_id),
                    'customer_id' => $serviceCall->customer_id,
                    'quote_id' => $serviceCall->quote_id,
                    'service_call_id' => $serviceCall->id,
                    'origin_type' => WorkOrder::ORIGIN_SERVICE_CALL,
                    'seller_id' => $serviceCall->quote?->seller_id,
                    'assigned_to' => $serviceCall->technician_id,
                    'driver_id' => $serviceCall->driver_id,
                    'created_by' => auth()->user()->id,
                    'status' => WorkOrder::STATUS_OPEN,
                    'priority' => $serviceCall->priority ?? 'normal',
                    'description' => $serviceCall->observations ?? "Gerada a partir do chamado {$serviceCall->call_number}",
                    'internal_notes' => "Origem: Chamado {$serviceCall->call_number}",
                ]);

                foreach ($serviceCall->equipments as $equip) {
                    $wo->equipmentsList()->syncWithoutDetaching([
                        $equip->id => ['observations' => $equip->pivot->observations ?? ''],
                    ]);
                }

                // Update service call status to completed if it was in_progress
                if ($serviceCall->status === ServiceCall::STATUS_IN_PROGRESS) {
                    $serviceCall->update([
                        'status' => ServiceCall::STATUS_COMPLETED,
                        'completed_at' => now(),
                    ]);
                }

                return $wo;
            });

            AuditLog::log('created', "OS criada a partir do chamado {$serviceCall->call_number}", $wo);
            return response()->json($wo->load(['customer:id,name,latitude,longitude', 'equipmentsList']), 201);
        } catch (\Throwable $e) {
            Log::error('ServiceCall convert failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao converter chamado em OS'], 500);
        }
    }

    // ── Comentários Internos ──

    public function comments(ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        return response()->json($serviceCall->comments()->with('user:id,name')->get());
    }

    public function addComment(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        $validated = $request->validate([
            'content' => 'required|string|max:2000',
        ]);

        try {
            $comment = DB::transaction(function () use ($serviceCall, $validated, $request) {
                $comment = $serviceCall->comments()->create([
                    'user_id' => $request->user()->id,
                    'content' => $validated['content'],
                ]);

                AuditLog::log('commented', "Comentário adicionado ao chamado {$serviceCall->call_number}", $serviceCall);

                return $comment;
            });

            return response()->json($comment->load('user:id,name'), 201);
        } catch (\Throwable $e) {
            Log::error('ServiceCall comment failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao adicionar comentário'], 500);
        }
    }

    // ── Exportação CSV ──

    public function exportCsv(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $query = ServiceCall::with(['customer:id,name', 'technician:id,name'])
            ->where('tenant_id', $tenantId);

        if ($status = $request->get('status')) $query->where('status', $status);
        if ($priority = $request->get('priority')) $query->where('priority', $priority);
        if ($techId = $request->get('technician_id')) $query->where('technician_id', $techId);
        if ($dateFrom = $request->get('date_from')) $query->where('created_at', '>=', $dateFrom);
        if ($dateTo = $request->get('date_to')) $query->where('created_at', '<=', $dateTo . ' 23:59:59');

        $calls = $query->orderByDesc('created_at')->get();

        $rows = [['Nº', 'Cliente', 'Técnico', 'Status', 'Prioridade', 'Cidade', 'UF', 'Agendado', 'Criado', 'SLA Estourado']];
        foreach ($calls as $call) {
            $rows[] = [
                $call->call_number,
                $call->customer?->name ?? '',
                $call->technician?->name ?? '',
                ServiceCall::STATUSES[$call->status]['label'] ?? $call->status,
                ServiceCall::PRIORITIES[$call->priority]['label'] ?? $call->priority,
                $call->city ?? '',
                $call->state ?? '',
                $call->scheduled_date ? Carbon::parse($call->scheduled_date)->format('d/m/Y H:i') : '',
                $call->created_at->format('d/m/Y H:i'),
                $call->sla_breached ? 'Sim' : 'Não',
            ];
        }

        $csv = '';
        foreach ($rows as $row) {
            $csv .= implode(';', array_map(fn($v) => '"' . str_replace('"', '""', $v) . '"', $row)) . "\n";
        }

        return response()->json(['csv' => $csv, 'filename' => 'chamados_' . now()->format('Y-m-d') . '.csv']);
    }

    // ── Mapa ──

    public function mapData(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $query = ServiceCall::with([
                'customer:id,name,phone',
                'technician:id,name',
            ])
            ->where('tenant_id', $tenantId)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        } else {
            $query->whereIn('status', [ServiceCall::STATUS_OPEN, ServiceCall::STATUS_SCHEDULED, ServiceCall::STATUS_IN_TRANSIT, ServiceCall::STATUS_IN_PROGRESS]);
        }

        $calls = $query->orderByDesc('scheduled_date')->get([
            'id',
            'call_number',
            'customer_id',
            'technician_id',
            'status',
            'priority',
            'latitude',
            'longitude',
            'city',
            'state',
            'observations',
            'scheduled_date',
            'created_at',
        ]);

        return response()->json(
            $calls->map(function (ServiceCall $call) {
                return [
                    'id' => $call->id,
                    'call_number' => $call->call_number,
                    'status' => $call->status,
                    'priority' => $call->priority,
                    'description' => $call->observations,
                    'latitude' => $call->latitude,
                    'longitude' => $call->longitude,
                    'city' => $call->city,
                    'state' => $call->state,
                    'scheduled_date' => $call->scheduled_date,
                    'created_at' => $call->created_at,
                    'customer' => $call->customer ? [
                        'id' => $call->customer->id,
                        'name' => $call->customer->name,
                        'phone' => $call->customer->phone,
                    ] : null,
                    'technician' => $call->technician ? [
                        'id' => $call->technician->id,
                        'name' => $call->technician->name,
                    ] : null,
                ];
            })
        );
    }

    // ── Agenda por técnico ──

    public function agenda(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $request->validate([
            'technician_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'start' => 'nullable|date',
            'end' => 'nullable|date',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
        ]);

        $query = ServiceCall::with(['customer:id,name', 'technician:id,name', 'driver:id,name', 'equipments'])
            ->where('tenant_id', $tenantId)
            ->whereNotIn('status', [ServiceCall::STATUS_CANCELLED]);

        if ($techId = $request->get('technician_id')) {
            $query->where('technician_id', $techId);
        }

        $start = $request->get('start', $request->get('date_from'));
        $end = $request->get('end', $request->get('date_to'));

        if ($start) $query->where('scheduled_date', '>=', $start);
        if ($end) $query->where('scheduled_date', '<=', $end);

        $calls = $query->orderBy('scheduled_date')->get();

        return response()->json(
            $calls->map(function (ServiceCall $call) {
                $scheduledTime = null;
                if ($call->scheduled_date) {
                    $scheduledTime = Carbon::parse($call->scheduled_date)->format('H:i');
                }

                return [
                    ...$call->toArray(),
                    'scheduled_time' => $scheduledTime,
                ];
            })
        );
    }

    public function auditTrail(ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        $logs = AuditLog::with('user:id,name')
            ->where('auditable_type', ServiceCall::class)
            ->where('auditable_id', $serviceCall->id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'action_label' => AuditLog::ACTIONS[$log->action] ?? $log->action,
                    'description' => $log->description,
                    'user' => $log->user,
                    'created_at' => $log->created_at,
                ];
            });

        return response()->json($logs);
    }

    public function summary(): JsonResponse
    {
        $base = ServiceCall::where('tenant_id', $this->currentTenantId());

        $activeBreached = (clone $base)
            ->whereNotIn('status', [ServiceCall::STATUS_COMPLETED, ServiceCall::STATUS_CANCELLED])
            ->whereRaw($this->slaBreachCondition('NULL'))
            ->count();

        return response()->json([
            'open' => (clone $base)->where('status', ServiceCall::STATUS_OPEN)->count(),
            'scheduled' => (clone $base)->where('status', ServiceCall::STATUS_SCHEDULED)->count(),
            'in_transit' => (clone $base)->where('status', ServiceCall::STATUS_IN_TRANSIT)->count(),
            'in_progress' => (clone $base)->where('status', ServiceCall::STATUS_IN_PROGRESS)->count(),
            'completed_today' => (clone $base)->where('status', ServiceCall::STATUS_COMPLETED)->whereDate('completed_at', today())->count(),
            'sla_breached_active' => $activeBreached,
        ]);
    }

    // ── Dashboard KPI ──

    public function dashboardKpi(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $days = $request->integer('days', 30);
        $since = now()->subDays($days);

        $base = ServiceCall::where('tenant_id', $tenantId);

        // Volume by day
        $volumeByDay = (clone $base)->where('created_at', '>=', $since)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as total')
            ->groupByRaw('DATE(created_at)')
            ->orderBy('date')
            ->get();

        // MTTR (Mean Time To Resolution) in hours
        $completed = (clone $base)->where('status', ServiceCall::STATUS_COMPLETED)
            ->where('completed_at', '>=', $since)
            ->whereNotNull('completed_at')
            ->whereNotNull('created_at')
            ->get(['created_at', 'completed_at']);
        $mttrHours = $completed->count() > 0
            ? round($completed->avg(fn($c) => $c->completed_at->diffInMinutes($c->created_at)) / 60, 1)
            : 0;

        // Mean time triage (open → scheduled) approximation
        $triaged = (clone $base)->where('created_at', '>=', $since)
            ->whereNotNull('scheduled_date')
            ->get(['created_at', 'scheduled_date']);
        $mtTriageHours = $triaged->count() > 0
            ? round($triaged->avg(fn($c) => Carbon::parse($c->scheduled_date)->diffInMinutes($c->created_at)) / 60, 1)
            : 0;

        // SLA breach rate
        $totalPeriod = (clone $base)->where('created_at', '>=', $since)->count();
        $breachedPeriod = (clone $base)->where('created_at', '>=', $since)
            ->whereRaw($this->slaBreachCondition('completed_at'))
            ->count();
        $slaBreachRate = $totalPeriod > 0 ? round(($breachedPeriod / $totalPeriod) * 100, 1) : 0;

        // Top 10 recurrent customers
        $topCustomers = (clone $base)->where('created_at', '>=', $since)
            ->selectRaw('customer_id, COUNT(*) as total')
            ->groupBy('customer_id')
            ->orderByDesc('total')
            ->limit(10)
            ->with('customer:id,name')
            ->get()
            ->map(fn($row) => ['customer' => $row->customer?->name, 'total' => $row->total]);

        // Reschedule rate
        $rescheduled = (clone $base)->where('created_at', '>=', $since)
            ->where('reschedule_count', '>', 0)->count();
        $rescheduleRate = $totalPeriod > 0 ? round(($rescheduled / $totalPeriod) * 100, 1) : 0;

        // By technician
        $byTechnician = (clone $base)->where('created_at', '>=', $since)
            ->selectRaw('technician_id, COUNT(*) as total')
            ->groupBy('technician_id')
            ->with('technician:id,name')
            ->get()
            ->map(fn($r) => ['technician' => $r->technician?->name ?? 'Sem técnico', 'total' => $r->total]);

        return response()->json([
            'mttr_hours' => $mttrHours,
            'mt_triage_hours' => $mtTriageHours,
            'sla_breach_rate' => $slaBreachRate,
            'reschedule_rate' => $rescheduleRate,
            'total_period' => $totalPeriod,
            'volume_by_day' => $volumeByDay,
            'top_customers' => $topCustomers,
            'by_technician' => $byTechnician,
        ]);
    }

    // ── Bulk Action ──

    public function bulkAction(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
            'action' => 'required|string|in:assign_technician,change_priority',
            'technician_id' => ['required_if:action,assign_technician', 'nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'priority' => 'required_if:action,change_priority|nullable|string|in:low,normal,high,urgent',
        ]);

        try {
            $calls = ServiceCall::where('tenant_id', $tenantId)
                ->whereIn('id', $validated['ids'])
                ->get();

            $updated = 0;
            DB::transaction(function () use ($calls, $validated, &$updated) {
                $updateData = match ($validated['action']) {
                    'assign_technician' => ['technician_id' => $validated['technician_id']],
                    'change_priority' => ['priority' => $validated['priority']],
                };
                $updated = $calls->count();
                ServiceCall::whereIn('id', $calls->pluck('id'))->update($updateData);
                AuditLog::log('bulk_action', "Ação em massa ({$validated['action']}) em {$updated} chamados", $calls->first());
            });

            return response()->json(['updated' => $updated]);
        } catch (\Throwable $e) {
            Log::error('ServiceCall bulk action failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na ação em massa'], 500);
        }
    }

    // ── Reschedule ──

    public function reschedule(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        $validated = $request->validate([
            'scheduled_date' => 'required|date|after:now',
            'reason' => 'required|string|max:500',
        ]);

        try {
            DB::transaction(function () use ($serviceCall, $validated) {
                $history = $serviceCall->reschedule_history ?? [];
                $history[] = [
                    'from' => $serviceCall->scheduled_date?->toIso8601String(),
                    'to' => $validated['scheduled_date'],
                    'reason' => $validated['reason'],
                    'by' => auth()->user()->name,
                    'at' => now()->toIso8601String(),
                ];

                $serviceCall->update([
                    'scheduled_date' => $validated['scheduled_date'],
                    'reschedule_count' => ($serviceCall->reschedule_count ?? 0) + 1,
                    'reschedule_reason' => $validated['reason'],
                    'reschedule_history' => $history,
                ]);

                AuditLog::log('rescheduled', "Chamado {$serviceCall->call_number} reagendado: {$validated['reason']}", $serviceCall);
            });

            return response()->json($serviceCall->fresh());
        } catch (\Throwable $e) {
            Log::error('ServiceCall reschedule failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao reagendar chamado'], 500);
        }
    }

    // ── Check Duplicate ──

    public function checkDuplicate(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $request->validate([
            'customer_id' => 'required|integer',
        ]);

        $duplicates = ServiceCall::where('tenant_id', $tenantId)
            ->where('customer_id', $request->integer('customer_id'))
            ->whereNotIn('status', [ServiceCall::STATUS_COMPLETED, ServiceCall::STATUS_CANCELLED])
            ->where('created_at', '>=', now()->subDays(30))
            ->with('technician:id,name')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get(['id', 'call_number', 'status', 'priority', 'technician_id', 'scheduled_date', 'created_at']);

        return response()->json([
            'has_duplicates' => $duplicates->isNotEmpty(),
            'duplicates' => $duplicates,
        ]);
    }

    // ── Webhook (external creation) ──

    public function webhookCreate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => 'required|integer|exists:tenants,id',
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $request->input('tenant_id')))],
            'priority' => 'nullable|string|in:low,normal,high,urgent',
            'observations' => 'nullable|string|max:3000',
            'address' => 'nullable|string|max:300',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:2',
        ]);

        try {
            $call = DB::transaction(function () use ($validated) {
                $call = ServiceCall::create([
                    ...$validated,
                    'call_number' => ServiceCall::nextNumber($validated['tenant_id']),
                    'status' => ServiceCall::STATUS_OPEN,
                    'priority' => $validated['priority'] ?? 'normal',
                    'created_by' => auth()->user()?->id,
                ]);

                AuditLog::log('created', "Chamado {$call->call_number} criado via webhook", $call);

                return $call;
            });

            return response()->json($call, 201);
        } catch (\Throwable $e) {
            Log::error('ServiceCall webhook create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar chamado via webhook'], 500);
        }
    }

    public function assignees(): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $users = User::query()
            ->where('is_active', true)
            ->where(function ($query) use ($tenantId) {
                $query
                    ->where('tenant_id', $tenantId)
                    ->orWhere('current_tenant_id', $tenantId)
                    ->orWhereHas('tenants', fn ($tenantQuery) => $tenantQuery->where('tenants.id', $tenantId));
            })
            ->whereHas('roles', fn ($query) => $query->whereIn('name', [Role::TECNICO, Role::MOTORISTA]))
            ->with('roles:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        $toPayload = fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];

        return response()->json([
            'technicians' => $users
                ->filter(fn (User $user) => $user->roles->contains('name', Role::TECNICO))
                ->values()
                ->map($toPayload),
            'drivers' => $users
                ->filter(fn (User $user) => $user->roles->contains('name', Role::MOTORISTA))
                ->values()
                ->map($toPayload),
        ]);
    }
}
