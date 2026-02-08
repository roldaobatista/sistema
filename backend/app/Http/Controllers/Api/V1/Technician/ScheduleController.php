<?php

namespace App\Http\Controllers\Api\V1\Technician;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Schedule::with([
            'technician:id,name',
            'customer:id,name',
            'workOrder:id,number,status',
        ]);

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
        $validated = $request->validate([
            'work_order_id' => 'nullable|exists:work_orders,id',
            'customer_id' => 'nullable|exists:customers,id',
            'technician_id' => 'required|exists:users,id',
            'title' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'scheduled_start' => 'required|date',
            'scheduled_end' => 'required|date|after:scheduled_start',
            'address' => 'nullable|string|max:500',
        ]);

    if (Schedule::hasConflict($validated['technician_id'], $validated['scheduled_start'], $validated['scheduled_end'])) {
        return response()->json([
            'message' => 'Conflito de horário — técnico já possui agendamento neste período',
        ], 409);
    }

    $schedule = Schedule::create([...$validated, 'status' => 'scheduled']);

    return response()->json($schedule->load(['technician:id,name', 'customer:id,name', 'workOrder:id,number']), 201);
    }

    public function show(Schedule $schedule): JsonResponse
    {
        return response()->json($schedule->load([
            'technician:id,name', 'customer:id,name,phone,email',
            'workOrder:id,number,status,description',
        ]));
    }

    public function update(Request $request, Schedule $schedule): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'nullable|exists:work_orders,id',
            'customer_id' => 'nullable|exists:customers,id',
            'technician_id' => 'sometimes|exists:users,id',
            'title' => 'sometimes|string|max:255',
            'notes' => 'nullable|string',
            'scheduled_start' => 'sometimes|date',
            'scheduled_end' => 'sometimes|date',
            'status' => 'sometimes|in:scheduled,confirmed,completed,cancelled',
            'address' => 'nullable|string|max:500',
        ]);

    $techId = $validated['technician_id'] ?? $schedule->technician_id;
    $start = $validated['scheduled_start'] ?? $schedule->scheduled_start;
    $end = $validated['scheduled_end'] ?? $schedule->scheduled_end;

    if (Schedule::hasConflict($techId, $start, $end, $schedule->id)) {
        return response()->json([
            'message' => 'Conflito de horário — técnico já possui agendamento neste período',
        ], 409);
    }

    $schedule->update($validated);
    return response()->json($schedule->fresh()->load(['technician:id,name', 'customer:id,name']));
    }

    public function destroy(Schedule $schedule): JsonResponse
    {
        $schedule->delete();
        return response()->json(null, 204);
    }

    /**
     * Agenda unificada: schedules + atividades CRM
     */
    public function unified(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfWeek()->toDateString());
        $to = $request->get('to', now()->endOfWeek()->toDateString());
        $techId = $request->get('technician_id');

        // Schedules normais
        $schedulesQuery = Schedule::with(['technician:id,name', 'customer:id,name', 'workOrder:id,number,status'])
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
                    'status' => $a->is_done ? 'completed' : 'scheduled',
                    'technician' => $a->user,
                    'customer' => null,
                    'deal' => $a->deal,
                    'notes' => $a->notes,
                    'crm_type' => $a->type,
                ]);
        }

        $all = $schedules->concat($crmActivities)->sortBy('start')->values();

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
}
