<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ServiceCall;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceCallController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ServiceCall::with(['customer:id,name', 'technician:id,name', 'driver:id,name'])
            ->withCount('equipments');

        if ($s = $request->get('search')) {
            $query->where(function ($q) use ($s) {
                $q->where('call_number', 'like', "%$s%")
                    ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%$s%"));
            });
        }
        if ($status = $request->get('status')) $query->where('status', $status);
        if ($techId = $request->get('technician_id')) $query->where('technician_id', $techId);
        if ($priority = $request->get('priority')) $query->where('priority', $priority);

        return response()->json($query->orderByDesc('created_at')->paginate($request->get('per_page', 30)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'quote_id' => 'nullable|exists:quotes,id',
            'technician_id' => 'nullable|exists:users,id',
            'driver_id' => 'nullable|exists:users,id',
            'priority' => 'nullable|in:low,normal,high,urgent',
            'scheduled_date' => 'nullable|date',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'state' => 'nullable|string|max:2',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'observations' => 'nullable|string',
            'equipment_ids' => 'nullable|array',
            'equipment_ids.*' => 'exists:equipments,id',
        ]);

        $call = ServiceCall::create([
            ...$validated,
            'tenant_id' => auth()->user()->tenant_id,
            'call_number' => ServiceCall::nextNumber(auth()->user()->tenant_id),
        ]);

        if (!empty($validated['equipment_ids'])) {
            $call->equipments()->attach($validated['equipment_ids']);
        }

        AuditLog::log('created', "Chamado {$call->call_number} criado", $call);
        return response()->json($call->load(['customer', 'technician', 'driver', 'equipments']), 201);
    }

    public function show(ServiceCall $serviceCall): JsonResponse
    {
        return response()->json($serviceCall->load([
            'customer.contacts', 'quote', 'technician:id,name', 'driver:id,name', 'equipments',
        ]));
    }

    public function update(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'sometimes|exists:customers,id',
            'technician_id' => 'nullable|exists:users,id',
            'driver_id' => 'nullable|exists:users,id',
            'priority' => 'nullable|in:low,normal,high,urgent',
            'scheduled_date' => 'nullable|date',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'state' => 'nullable|string|max:2',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'observations' => 'nullable|string',
        ]);

        $serviceCall->update($validated);
        return response()->json($serviceCall->fresh(['customer', 'technician', 'driver', 'equipments']));
    }

    public function destroy(ServiceCall $serviceCall): JsonResponse
    {
        $hasWorkOrder = WorkOrder::where('service_call_id', $serviceCall->id)->exists();
        if ($hasWorkOrder) {
            return response()->json([
                'message' => 'Não é possível excluir — chamado possui OS vinculada',
            ], 409);
        }

        $serviceCall->delete();
        return response()->json(null, 204);
    }

    // ── Ações de Negócio ──

    public function updateStatus(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:open,scheduled,in_transit,in_progress,completed,cancelled',
        ]);

        $old = $serviceCall->status;
        $serviceCall->update([
            'status' => $validated['status'],
            'started_at' => $validated['status'] === 'in_progress' && !$serviceCall->started_at ? now() : $serviceCall->started_at,
            'completed_at' => $validated['status'] === 'completed' ? now() : $serviceCall->completed_at,
        ]);

        AuditLog::log('status_changed', "Chamado {$serviceCall->call_number}: $old → {$validated['status']}", $serviceCall);
        return response()->json($serviceCall);
    }

    public function assignTechnician(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        $validated = $request->validate([
            'technician_id' => 'required|exists:users,id',
            'driver_id' => 'nullable|exists:users,id',
            'scheduled_date' => 'nullable|date',
        ]);

        $serviceCall->update([
            ...$validated,
            'status' => $serviceCall->status === 'open' ? 'scheduled' : $serviceCall->status,
        ]);

        AuditLog::log('updated', "Técnico atribuído ao chamado {$serviceCall->call_number}", $serviceCall);
        return response()->json($serviceCall->fresh(['technician', 'driver']));
    }

    public function convertToWorkOrder(ServiceCall $serviceCall): JsonResponse
    {
        if (!in_array($serviceCall->status, ['completed', 'in_progress'])) {
            return response()->json(['message' => 'Chamado precisa estar em atendimento ou concluído'], 422);
        }

        $wo = WorkOrder::create([
            'tenant_id' => $serviceCall->tenant_id,
            'customer_id' => $serviceCall->customer_id,
            'quote_id' => $serviceCall->quote_id,
            'service_call_id' => $serviceCall->id,
            'origin_type' => 'service_call',
            'seller_id' => $serviceCall->quote?->seller_id,
            'assigned_to' => $serviceCall->technician_id,
            'driver_id' => $serviceCall->driver_id,
            'status' => 'open',
            'priority' => $serviceCall->priority ?? 'normal',
            'description' => $serviceCall->observations ?? "Gerada a partir do chamado {$serviceCall->call_number}",
            'internal_notes' => "Origem: Chamado {$serviceCall->call_number}",
        ]);

        // Copiar equipamentos do chamado para a OS
        foreach ($serviceCall->equipments as $equip) {
            $wo->equipmentsList()->syncWithoutDetaching([
                $equip->id => ['observations' => $equip->pivot->observations ?? ''],
            ]);
        }

        AuditLog::log('created', "OS criada a partir do chamado {$serviceCall->call_number}", $wo);
        return response()->json($wo->load('equipmentsList'), 201);
    }

    // ── Mapa ──

    public function mapData(): JsonResponse
    {
        $calls = ServiceCall::with('customer:id,name')
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->whereIn('status', ['open', 'scheduled', 'in_transit', 'in_progress'])
            ->get(['id', 'call_number', 'customer_id', 'status', 'priority', 'latitude', 'longitude', 'city', 'state', 'scheduled_date']);

        return response()->json($calls);
    }

    // ── Agenda por técnico ──

    public function agenda(Request $request): JsonResponse
    {
        $request->validate([
            'technician_id' => 'required|exists:users,id',
            'start' => 'nullable|date',
            'end' => 'nullable|date',
        ]);

        $query = ServiceCall::with(['customer:id,name', 'equipments'])
            ->where('technician_id', $request->get('technician_id'))
            ->whereNotIn('status', ['cancelled']);

        if ($start = $request->get('start')) $query->where('scheduled_date', '>=', $start);
        if ($end = $request->get('end')) $query->where('scheduled_date', '<=', $end);

        return response()->json($query->orderBy('scheduled_date')->get());
    }

    public function summary(): JsonResponse
    {
        $base = ServiceCall::query();
        return response()->json([
            'open' => (clone $base)->where('status', 'open')->count(),
            'scheduled' => (clone $base)->where('status', 'scheduled')->count(),
            'in_progress' => (clone $base)->whereIn('status', ['in_transit', 'in_progress'])->count(),
            'completed_today' => (clone $base)->where('status', 'completed')->whereDate('completed_at', today())->count(),
        ]);
    }
}
