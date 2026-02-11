<?php

namespace App\Http\Controllers\Api\V1\Technician;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Models\WorkOrder;

class ScheduleController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $query = Schedule::with([
            'technician:id,name',
            'customer:id,name',
            'workOrder:id,number,os_number,status',
        ])->where('tenant_id', $tenantId);

        if ($techId = $request->get('technician_id')) {
            $query->where('technician_id', $techId);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($date = $request->get('date')) {
            $query->whereDate('scheduled_start', $date);
        }

        if ($from = $request->get('from')) {
            $query->where('scheduled_start', '>=', $from);
        }

        if ($to = $request->get('to')) {
            $query->where('scheduled_end', '<=', $to);
        }

        $schedules = $query->orderBy('scheduled_start')
            ->paginate($request->get('per_page', 50));

        return response()->json($schedules);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'customer_id' => ['nullable', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'technician_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'title' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'scheduled_start' => 'required|date',
            'scheduled_end' => 'required|date|after:scheduled_start',
            'address' => 'nullable|string|max:500',
        ]);

        if (Schedule::hasConflict($validated['technician_id'], $validated['scheduled_start'], $validated['scheduled_end'], null, $tenantId)) {
            return response()->json([
                'message' => 'Conflito de horário — técnico já possui agendamento neste período',
            ], 409);
        }

        $schedule = DB::transaction(function () use ($validated, $tenantId) {
            return Schedule::create([...$validated, 'tenant_id' => $tenantId, 'status' => Schedule::STATUS_SCHEDULED]);
        });

        return response()->json($schedule->load(['technician:id,name', 'customer:id,name', 'workOrder:id,number,os_number']), 201);
    }

    public function show(Request $request, Schedule $schedule): JsonResponse
    {
        abort_unless($schedule->tenant_id === $this->tenantId($request), 404);

        return response()->json($schedule->load([
            'technician:id,name', 'customer:id,name,phone,email',
            'workOrder:id,number,os_number,status,description',
        ]));
    }

    public function update(Request $request, Schedule $schedule): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'customer_id' => ['nullable', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'technician_id' => ['sometimes', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'title' => 'sometimes|string|max:255',
            'notes' => 'nullable|string',
            'scheduled_start' => 'sometimes|date',
            'scheduled_end' => 'sometimes|date|after_or_equal:scheduled_start',
            'status' => ['sometimes', Rule::in(array_keys(Schedule::STATUSES))],
            'address' => 'nullable|string|max:500',
        ]);

        abort_unless($schedule->tenant_id === $tenantId, 404);

        $techId = $validated['technician_id'] ?? $schedule->technician_id;
        $start = $validated['scheduled_start'] ?? $schedule->scheduled_start;
        $end = $validated['scheduled_end'] ?? $schedule->scheduled_end;

        if (Schedule::hasConflict($techId, $start, $end, $schedule->id, $tenantId)) {
            return response()->json([
                'message' => 'Conflito de horário — técnico já possui agendamento neste período',
            ], 409);
        }

        DB::transaction(function () use ($schedule, $validated) {
            $schedule->update($validated);
        });

        return response()->json($schedule->fresh()->load(['technician:id,name', 'customer:id,name']));
    }

    public function destroy(Request $request, Schedule $schedule): JsonResponse
    {
        abort_unless($schedule->tenant_id === $this->tenantId($request), 404);

        $schedule->delete();
        return response()->json(null, 204);
    }

    /**
     * Agenda unificada: schedules + atividades CRM
     */
    public function unified(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $from = $request->get('from', now()->startOfWeek()->toDateString());
        $to = $request->get('to', now()->endOfWeek()->toDateString());
        $techId = $request->get('technician_id');

        // Schedules normais
        $schedulesQuery = Schedule::with(['technician:id,name', 'customer:id,name', 'workOrder:id,number,os_number,status'])
            ->where('tenant_id', $tenantId)
            ->where('scheduled_start', '>=', $from)
            ->where('scheduled_end', '<=', "$to 23:59:59");

        if ($techId) {
            $schedulesQuery->where('technician_id', $techId);
        }

        $schedules = $schedulesQuery->orderBy('scheduled_start')->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'source' => 'schedule',
                'title' => $s->title,
                'start' => $s->scheduled_start,
                'end' => $s->scheduled_end,
                'status' => $s->status,
                'technician' => $s->technician,
                'customer' => $s->customer,
                'work_order' => $s->workOrder,
                'notes' => $s->notes,
                'address' => $s->address,
            ]);

        // Atividades CRM (meetings/tasks) do período
        $crmActivities = collect([]);
        if (class_exists(\App\Models\CrmActivity::class)) {
            $crmQuery = \App\Models\CrmActivity::with(['deal:id,title', 'user:id,name'])
                ->where('tenant_id', $tenantId)
                ->whereIn('type', ['meeting', 'task'])
                ->where('due_date', '>=', $from)
                ->where('due_date', '<=', "$to 23:59:59");

            if ($techId) {
                $crmQuery->where('user_id', $techId);
            }

            $crmActivities = $crmQuery->orderBy('due_date')->get()
                ->map(fn ($a) => [
                    'id' => "crm-{$a->id}",
                    'source' => 'crm',
                    'title' => $a->subject,
                    'start' => $a->due_date,
                    'end' => $a->due_date,
                    'status' => $a->is_done ? Schedule::STATUS_COMPLETED : Schedule::STATUS_SCHEDULED,
                    'technician' => $a->user,
                    'customer' => null,
                    'deal' => $a->deal,
                    'notes' => $a->notes,
                    'crm_type' => $a->type,
                ]);
        }

        $serviceCalls = $this->getServiceCalls($tenantId, $from, $to, $techId);

        $all = $schedules->concat($crmActivities)->concat($serviceCalls)->sortBy('start')->values();

        return response()->json([
            'data' => $all,
            'meta' => [
                'schedules_count' => $schedules->count(),
                'crm_activities_count' => $crmActivities->count(),
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }

    private function getServiceCalls(int $tenantId, string $from, string $to, ?int $techId)
    {
        $query = \App\Models\ServiceCall::with(['customer:id,name', 'technician:id,name'])
            ->where('tenant_id', $tenantId)
            ->whereNotNull('scheduled_date')
            ->whereBetween('scheduled_date', [$from, "$to 23:59:59"]);

        if ($techId) {
            $query->where('technician_id', $techId);
        }

        return $query->orderBy('scheduled_date')->get()
            ->map(fn ($c) => [
                'id' => "call-{$c->id}",
                'source' => 'service_call',
                'title' => "Chamado #{$c->call_number}",
                'start' => $c->scheduled_date,
                'end' => \Carbon\Carbon::parse($c->scheduled_date)->addHour()->toDateTimeString(), // Estimativa de 1h
                'status' => $c->status,
                'technician' => $c->technician,
                'customer' => $c->customer,
                'work_order' => null, // Poderia buscar se tiver relacionamento
                'notes' => $c->observations,
                'address' => $c->address . ($c->city ? ", {$c->city}" : ''),
                'priority' => $c->priority,
            ]);
    }

    /**
     * Verifica conflitos de horário antes de salvar (API pública para frontend)
     */
    public function conflicts(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'technician_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'start' => 'required|date',
            'end' => 'required|date|after:start',
            'exclude_schedule_id' => ['nullable', Rule::exists('schedules', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ]);

        $hasConflict = Schedule::hasConflict(
            $validated['technician_id'],
            $validated['start'],
            $validated['end'],
            $validated['exclude_schedule_id'] ?? null,
            $tenantId
        );

        if ($hasConflict) {
            $conflict = Schedule::where('technician_id', $validated['technician_id'])
                ->where('tenant_id', $tenantId)
                ->where(function ($q) use ($validated) {
                    $q->whereBetween('scheduled_start', [$validated['start'], $validated['end']])
                      ->orWhereBetween('scheduled_end', [$validated['start'], $validated['end']])
                      ->orWhere(function ($q2) use ($validated) {
                          $q2->where('scheduled_start', '<=', $validated['start'])
                             ->where('scheduled_end', '>=', $validated['end']);
                      });
                });

            if (!empty($validated['exclude_schedule_id'])) {
                $conflict->where('id', '!=', $validated['exclude_schedule_id']);
            }

            $conflictingSchedule = $conflict->with('customer:id,name')->first();

            return response()->json([
                'conflict' => true,
                'message' => 'Horário indisponível.',
                'details' => $conflictingSchedule
            ]);
        }

        return response()->json(['conflict' => false, 'message' => 'Horário disponível.']);
    }

    /**
     * Resumo da carga de trabalho dos técnicos (horas/dia ou total no período)
     */
    public function workloadSummary(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $from = $request->get('from', now()->startOfWeek()->toDateString());
        $to = $request->get('to', now()->endOfWeek()->toDateString());

        $workloads = Schedule::with('technician:id,name')
            ->where('tenant_id', $tenantId)
            ->whereBetween('scheduled_start', [$from, "$to 23:59:59"])
            ->get()
            ->groupBy('technician_id')
            ->map(function ($schedules, $techId) {
                $technician = $schedules->first()->technician;
                $totalMinutes = $schedules->sum(fn($s) => 
                    \Carbon\Carbon::parse($s->scheduled_end)->diffInMinutes(\Carbon\Carbon::parse($s->scheduled_start))
                );

                return [
                    'technician_id' => $techId,
                    'technician_name' => $technician?->name ?? 'Desconhecido',
                    'total_hours' => round($totalMinutes / 60, 2),
                    'schedules_count' => $schedules->count(),
                ];
            })->values();

        return response()->json(['workloads' => $workloads, 'period' => ['from' => $from, 'to' => $to]]);
    }

    /**
     * Sugestão simplificada de roteamento baseada em agrupamento por cidade
     */
    public function suggestRouting(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $pendingWorkOrders = WorkOrder::where('tenant_id', $tenantId)
            ->where('status', WorkOrder::STATUS_OPEN)
            ->with(['customer.addresses' => function($q) {
                $q->where('is_main', true)->limit(1);
            }])
            ->get()
            ->filter(fn($wo) => $wo->customer && $wo->customer->addresses->isNotEmpty())
            ->groupBy(fn($wo) => $wo->customer->addresses->first()->city ?? 'Indefinido')
            ->map(fn($group, $city) => [
                'city' => $city,
                'count' => $group->count(),
                'work_orders' => $group->map(fn($wo) => [
                    'id' => $wo->id,
                    'number' => $wo->os_number ?? $wo->number,
                    'internal_number' => $wo->number,
                    'os_number' => $wo->os_number,
                    'priority' => $wo->priority,
                    'customer' => $wo->customer->name,
                    'address' => ($wo->customer->addresses->first()->street ?? '') . ', ' . ($wo->customer->addresses->first()->number ?? ''),
                ])
            ])
            ->values();

        return response()->json(['routing_suggestions' => $pendingWorkOrders]);
    }
}
