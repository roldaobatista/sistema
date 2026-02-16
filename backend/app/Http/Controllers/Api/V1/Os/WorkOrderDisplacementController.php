<?php

namespace App\Http\Controllers\Api\V1\Os;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Models\WorkOrderDisplacementLocation;
use App\Models\WorkOrderDisplacementStop;
use App\Events\TechnicianLocationUpdated;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkOrderDisplacementController extends Controller
{
    public function index(WorkOrder $workOrder): JsonResponse
    {
        $this->authorizeTechnician($workOrder);

        $workOrder->load(['displacementStops', 'displacementLocations' => fn ($q) => $q->orderBy('recorded_at')->limit(100)]);

        return response()->json([
            'displacement_started_at' => $workOrder->displacement_started_at?->toIso8601String(),
            'displacement_arrived_at' => $workOrder->displacement_arrived_at?->toIso8601String(),
            'displacement_duration_minutes' => $workOrder->displacement_duration_minutes,
            'displacement_status' => $this->displacementStatus($workOrder),
            'stops' => $workOrder->displacementStops->map(fn ($s) => [
                'id' => $s->id,
                'type' => $s->type,
                'type_label' => WorkOrderDisplacementStop::TYPES[$s->type] ?? $s->type,
                'started_at' => $s->started_at->toIso8601String(),
                'ended_at' => $s->ended_at?->toIso8601String(),
                'duration_minutes' => $s->duration_minutes,
                'notes' => $s->notes,
            ]),
            'locations_count' => $workOrder->displacementLocations()->count(),
        ]);
    }

    public function start(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $this->authorizeTechnician($workOrder);

        if ($workOrder->displacement_started_at) {
            return response()->json(['message' => 'Deslocamento já iniciado.'], 422);
        }

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        DB::beginTransaction();
        try {
            $workOrder->update([
                'displacement_started_at' => now(),
            ]);

            WorkOrderDisplacementLocation::create([
                'work_order_id' => $workOrder->id,
                'user_id' => $request->user()->id,
                'latitude' => $validated['latitude'],
                'longitude' => $validated['longitude'],
                'recorded_at' => now(),
            ]);

            $this->updateUserLocation($request->user(), $validated['latitude'], $validated['longitude']);

            DB::commit();

            return response()->json([
                'message' => 'Deslocamento iniciado.',
                'displacement_started_at' => $workOrder->displacement_started_at->toIso8601String(),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function arrive(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $this->authorizeTechnician($workOrder);

        if (!$workOrder->displacement_started_at) {
            return response()->json(['message' => 'Deslocamento não foi iniciado.'], 422);
        }
        if ($workOrder->displacement_arrived_at) {
            return response()->json(['message' => 'Chegada já registrada.'], 422);
        }

        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        DB::beginTransaction();
        try {
            $workOrder->update([
                'displacement_arrived_at' => now(),
            ]);

            if (isset($validated['latitude']) && isset($validated['longitude'])) {
                WorkOrderDisplacementLocation::create([
                    'work_order_id' => $workOrder->id,
                    'user_id' => $request->user()->id,
                    'latitude' => $validated['latitude'],
                    'longitude' => $validated['longitude'],
                    'recorded_at' => now(),
                ]);
                $this->updateUserLocation($request->user(), $validated['latitude'], $validated['longitude']);
            }

            $this->recalculateDisplacementDuration($workOrder);

            DB::commit();

            return response()->json([
                'message' => 'Chegada registrada.',
                'displacement_arrived_at' => $workOrder->fresh()->displacement_arrived_at->toIso8601String(),
                'displacement_duration_minutes' => $workOrder->fresh()->displacement_duration_minutes,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function recordLocation(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $this->authorizeTechnician($workOrder);

        if (!$workOrder->displacement_started_at || $workOrder->displacement_arrived_at) {
            return response()->json(['message' => 'Deslocamento não está em andamento.'], 422);
        }

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        WorkOrderDisplacementLocation::create([
            'work_order_id' => $workOrder->id,
            'user_id' => $request->user()->id,
            'latitude' => $validated['latitude'],
            'longitude' => $validated['longitude'],
            'recorded_at' => now(),
        ]);

        $this->updateUserLocation($request->user(), $validated['latitude'], $validated['longitude']);

        return response()->json([
            'message' => 'Localização registrada.',
            'recorded_at' => now()->toIso8601String(),
        ], 201);
    }

    public function addStop(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $this->authorizeTechnician($workOrder);

        if (!$workOrder->displacement_started_at || $workOrder->displacement_arrived_at) {
            return response()->json(['message' => 'Deslocamento não está em andamento.'], 422);
        }

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:lunch,hotel,br_stop,other'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $stop = WorkOrderDisplacementStop::create([
            'work_order_id' => $workOrder->id,
            'type' => $validated['type'],
            'started_at' => now(),
            'notes' => $validated['notes'] ?? null,
            'location_lat' => $validated['latitude'] ?? null,
            'location_lng' => $validated['longitude'] ?? null,
        ]);

        return response()->json([
            'message' => 'Parada registrada.',
            'stop' => [
                'id' => $stop->id,
                'type' => $stop->type,
                'type_label' => WorkOrderDisplacementStop::TYPES[$stop->type] ?? $stop->type,
                'started_at' => $stop->started_at->toIso8601String(),
            ],
        ], 201);
    }

    public function endStop(Request $request, WorkOrder $workOrder, WorkOrderDisplacementStop $stop): JsonResponse
    {
        $this->authorizeTechnician($workOrder);

        if ($stop->work_order_id !== (int) $workOrder->id) {
            abort(404);
        }
        if ($stop->ended_at) {
            return response()->json(['message' => 'Parada já finalizada.'], 422);
        }

        $stop->update(['ended_at' => now()]);

        if ($workOrder->displacement_arrived_at) {
            $this->recalculateDisplacementDuration($workOrder);
        }

        return response()->json([
            'message' => 'Parada finalizada.',
            'stop' => [
                'id' => $stop->id,
                'ended_at' => $stop->fresh()->ended_at->toIso8601String(),
                'duration_minutes' => $stop->fresh()->duration_minutes,
            ],
        ], 200);
    }

    protected function authorizeTechnician(WorkOrder $workOrder): void
    {
        if (!$workOrder->isTechnicianAuthorized(auth()->id())) {
            abort(403, 'Você não está autorizado a gerenciar o deslocamento desta OS.');
        }
    }

    protected function updateUserLocation($user, float $lat, float $lng): void
    {
        $user->forceFill([
            'location_lat' => $lat,
            'location_lng' => $lng,
            'location_updated_at' => now(),
        ])->save();
        broadcast(new TechnicianLocationUpdated($user));
    }

    protected function recalculateDisplacementDuration(WorkOrder $workOrder): void
    {
        $start = Carbon::parse($workOrder->displacement_started_at);
        $arrived = Carbon::parse($workOrder->displacement_arrived_at);
        $grossMinutes = (int) $start->diffInMinutes($arrived);

        $stopMinutes = $workOrder->displacementStops()
            ->whereNotNull('ended_at')
            ->get()
            ->sum(fn ($s) => $s->duration_minutes ?? 0);

        $effectiveMinutes = max(0, $grossMinutes - $stopMinutes);

        $workOrder->update(['displacement_duration_minutes' => $effectiveMinutes]);
    }

    protected function displacementStatus(WorkOrder $workOrder): string
    {
        if (!$workOrder->displacement_started_at) {
            return 'not_started';
        }
        if ($workOrder->displacement_arrived_at) {
            return 'arrived';
        }
        return 'in_progress';
    }
}
