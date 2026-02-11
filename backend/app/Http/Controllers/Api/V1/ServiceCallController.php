<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ServiceCall;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ServiceCallController extends Controller
{
    private function currentTenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $query = ServiceCall::with(['customer:id,name', 'technician:id,name', 'driver:id,name'])
            ->withCount('equipments')
            ->where('tenant_id', $tenantId);

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
        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'quote_id' => ['nullable', Rule::exists('quotes', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'technician_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'priority' => ['nullable', Rule::in(array_keys(ServiceCall::PRIORITIES))],
            'scheduled_date' => 'nullable|date',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'state' => 'nullable|string|max:2',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'observations' => 'nullable|string',
            'equipment_ids' => 'nullable|array',
            'equipment_ids.*' => [Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ]);

        $equipmentIds = $validated['equipment_ids'] ?? [];
        unset($validated['equipment_ids']);

        try {
            $call = ServiceCall::create([
                ...$validated,
                'tenant_id' => $tenantId,
                'created_by' => $request->user()->id,
                'call_number' => ServiceCall::nextNumber($tenantId),
            ]);

            if (!empty($equipmentIds)) {
                $call->equipments()->attach($equipmentIds);
            }

            AuditLog::log('created', "Chamado {$call->call_number} criado", $call);

            event(new \App\Events\ServiceCallCreated($call, auth()->user()));

            return response()->json($call->load(['customer', 'technician', 'driver', 'equipments']), 201);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao criar chamado: ' . $e->getMessage()], 500);
        }
    }

    public function show(ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        return response()->json($serviceCall->load([
            'customer.contacts', 'quote', 'technician:id,name', 'driver:id,name', 'equipments',
        ]));
    }

    public function update(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        if ((int) $serviceCall->tenant_id !== $tenantId) {
            abort(403);
        }

        $validated = $request->validate([
            'customer_id' => ['sometimes', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'technician_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'priority' => ['nullable', Rule::in(array_keys(ServiceCall::PRIORITIES))],
            'scheduled_date' => 'nullable|date',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'state' => 'nullable|string|max:2',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'observations' => 'nullable|string',
            'equipment_ids' => 'nullable|array',
            'equipment_ids.*' => [Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ]);

        $equipmentIds = $validated['equipment_ids'] ?? null;
        unset($validated['equipment_ids']);

        try {
            $serviceCall->update($validated);

            if ($equipmentIds !== null) {
                $serviceCall->equipments()->sync($equipmentIds);
            }

            AuditLog::log('updated', "Chamado {$serviceCall->call_number} atualizado", $serviceCall);

            return response()->json($serviceCall->fresh(['customer', 'technician', 'driver', 'equipments']));
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao atualizar chamado: ' . $e->getMessage()], 500);
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

        AuditLog::log('deleted', "Chamado {$serviceCall->call_number} excluído", $serviceCall);
        $serviceCall->delete();
        return response()->json(null, 204);
    }

    // ── Ações de Negócio ──

    public function updateStatus(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        if ((int) $serviceCall->tenant_id !== $this->currentTenantId()) {
            abort(403);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(array_keys(ServiceCall::STATUSES))],
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

        $old = $serviceCall->status;

        $updateData = [
            'status' => $validated['status'],
        ];

        if ($validated['status'] === ServiceCall::STATUS_IN_PROGRESS && !$serviceCall->started_at) {
            $updateData['started_at'] = now();
        }
        if ($validated['status'] === ServiceCall::STATUS_COMPLETED) {
            $updateData['completed_at'] = now();
        }
        // Ao reabrir chamado, limpar timestamps
        if ($validated['status'] === ServiceCall::STATUS_OPEN) {
            $updateData['started_at'] = null;
            $updateData['completed_at'] = null;
        }

        $serviceCall->update($updateData);

        AuditLog::log('status_changed', "Chamado {$serviceCall->call_number}: $old → {$validated['status']}", $serviceCall);

        event(new \App\Events\ServiceCallStatusChanged($serviceCall, $old, $validated['status'], auth()->user()));

        return response()->json($serviceCall);
    }

    public function assignTechnician(Request $request, ServiceCall $serviceCall): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        if ((int) $serviceCall->tenant_id !== $tenantId) {
            abort(403);
        }

        $validated = $request->validate([
            'technician_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'scheduled_date' => 'nullable|date',
        ]);

        try {
            $newStatus = $serviceCall->status;
            if ($serviceCall->status === ServiceCall::STATUS_OPEN && $serviceCall->canTransitionTo(ServiceCall::STATUS_SCHEDULED)) {
                $newStatus = ServiceCall::STATUS_SCHEDULED;
            }

            $serviceCall->update([
                ...$validated,
                'status' => $newStatus,
            ]);

            AuditLog::log('updated', "Técnico atribuído ao chamado {$serviceCall->call_number}", $serviceCall);
            return response()->json($serviceCall->fresh(['technician', 'driver']));
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao atribuir técnico: ' . $e->getMessage()], 500);
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

                return $wo;
            });

            AuditLog::log('created', "OS criada a partir do chamado {$serviceCall->call_number}", $wo);
            return response()->json($wo->load('equipmentsList'), 201);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao converter chamado em OS: ' . $e->getMessage()], 500);
        }
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

    public function summary(): JsonResponse
    {
        $base = ServiceCall::where('tenant_id', $this->currentTenantId());
        return response()->json([
            'open' => (clone $base)->where('status', ServiceCall::STATUS_OPEN)->count(),
            'scheduled' => (clone $base)->where('status', ServiceCall::STATUS_SCHEDULED)->count(),
            'in_transit' => (clone $base)->where('status', ServiceCall::STATUS_IN_TRANSIT)->count(),
            'in_progress' => (clone $base)->where('status', ServiceCall::STATUS_IN_PROGRESS)->count(),

            'completed_today' => (clone $base)->where('status', ServiceCall::STATUS_COMPLETED)->whereDate('completed_at', today())->count(),
        ]);
    }
}

