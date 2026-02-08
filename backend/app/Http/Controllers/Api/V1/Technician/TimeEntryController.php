<?php

namespace App\Http\Controllers\Api\V1\Technician;

use App\Http\Controllers\Controller;
use App\Models\TimeEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimeEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = TimeEntry::with([
            'technician:id,name',
            'workOrder:id,number',
        ]);

        if ($techId = $request->get('technician_id')) {
            $query->where('technician_id', $techId);
        }

        if ($woId = $request->get('work_order_id')) {
            $query->where('work_order_id', $woId);
        }

        if ($from = $request->get('from')) {
            $query->where('started_at', '>=', $from);
        }

        if ($to = $request->get('to')) {
            $query->where('started_at', '<=', $to);
        }

        if ($type = $request->get('type')) {
            $query->where('type', $type);
        }

        $entries = $query->orderByDesc('started_at')
            ->paginate($request->get('per_page', 50));

        return response()->json($entries);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'technician_id' => 'required|exists:users,id',
            'schedule_id' => 'nullable|exists:schedules,id',
            'started_at' => 'required|date',
            'ended_at' => 'nullable|date|after:started_at',
            'type' => 'sometimes|in:work,travel,waiting',
            'description' => 'nullable|string',
        ]);

        $entry = TimeEntry::create($validated);
        return response()->json($entry->load(['technician:id,name', 'workOrder:id,number']), 201);
    }

    public function update(Request $request, TimeEntry $timeEntry): JsonResponse
    {
        $validated = $request->validate([
            'started_at' => 'sometimes|date',
            'ended_at' => 'nullable|date',
            'type' => 'sometimes|in:work,travel,waiting',
            'description' => 'nullable|string',
        ]);

        $timeEntry->update($validated);
        return response()->json($timeEntry->fresh()->load(['technician:id,name', 'workOrder:id,number']));
    }

    public function destroy(TimeEntry $timeEntry): JsonResponse
    {
        $timeEntry->delete();
        return response()->json(null, 204);
    }

    // Timer: inicia um apontamento (sem ended_at)
    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'type' => 'sometimes|in:work,travel,waiting',
            'description' => 'nullable|string',
        ]);

        $entry = TimeEntry::create([
            ...$validated,
            'technician_id' => $request->user()->id,
            'started_at' => now(),
        ]);

        return response()->json($entry->load(['workOrder:id,number']), 201);
    }

    // Timer: finaliza apontamento em andamento
    public function stop(Request $request, TimeEntry $timeEntry): JsonResponse
    {
        if ($timeEntry->ended_at) {
            return response()->json(['message' => 'Apontamento já finalizado'], 422);
        }

        $timeEntry->update(['ended_at' => now()]);
        return response()->json($timeEntry->fresh()->load(['workOrder:id,number']));
    }

    // Resumo de horas por técnico (dashboard)
    public function summary(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfWeek()->toDateString());
        $to = $request->get('to', now()->endOfWeek()->toDateString());

        $entries = TimeEntry::selectRaw('technician_id, type, SUM(duration_minutes) as total_minutes, COUNT(*) as entries_count')
            ->whereBetween('started_at', [$from, $to])
            ->whereNotNull('ended_at')
            ->groupBy('technician_id', 'type')
            ->with('technician:id,name')
            ->get();

        return response()->json([
            'period' => compact('from', 'to'),
            'data' => $entries,
        ]);
    }
}
