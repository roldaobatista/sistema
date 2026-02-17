<?php

namespace App\Http\Controllers\Api\V1\Technician;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TimeEntryController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    private function hasRunningEntry(int $tenantId, int $technicianId, ?int $excludeEntryId = null): bool
    {
        return TimeEntry::query()
            ->where('tenant_id', $tenantId)
            ->where('technician_id', $technicianId)
            ->whereNull('ended_at')
            ->when($excludeEntryId, fn ($query) => $query->where('id', '!=', $excludeEntryId))
            ->exists();
    }

    private function userBelongsToTenant(int $userId, int $tenantId): bool
    {
        return User::query()
            ->where('id', $userId)
            ->where(function ($query) use ($tenantId) {
                $query
                    ->where('tenant_id', $tenantId)
                    ->orWhere('current_tenant_id', $tenantId)
                    ->orWhereHas('tenants', fn ($tenantQuery) => $tenantQuery->where('tenants.id', $tenantId));
            })
            ->exists();
    }

    private function ensureTenantUser(int $userId, int $tenantId, string $field = 'technician_id'): void
    {
        if (!$this->userBelongsToTenant($userId, $tenantId)) {
            throw ValidationException::withMessages([
                $field => ['Usuario nao pertence ao tenant atual.'],
            ]);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $query = TimeEntry::with([
            'technician:id,name',
            'workOrder:id,number,os_number',
        ])->where('tenant_id', $tenantId);

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
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'work_order_id' => ['required', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'technician_id' => ['required', Rule::exists('users', 'id')],
            'schedule_id' => ['nullable', Rule::exists('schedules', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'started_at' => 'required|date',
            'ended_at' => 'nullable|date|after:started_at',
            'type' => ['sometimes', Rule::in(array_keys(TimeEntry::TYPES))],
            'description' => 'nullable|string',
        ]);
        $this->ensureTenantUser((int) $validated['technician_id'], $tenantId);

        $isOpenEntry = !array_key_exists('ended_at', $validated) || $validated['ended_at'] === null;
        if ($isOpenEntry && $this->hasRunningEntry($tenantId, (int) $validated['technician_id'])) {
            return response()->json([
                'message' => 'Tecnico ja possui apontamento em andamento.',
            ], 409);
        }

        try {
            $entry = DB::transaction(function () use ($validated, $tenantId) {
                return TimeEntry::create([...$validated, 'tenant_id' => $tenantId]);
            });
            return response()->json($entry->load(['technician:id,name', 'workOrder:id,number,os_number']), 201);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('TimeEntry store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar apontamento'], 500);
        }
    }

    public function update(Request $request, TimeEntry $timeEntry): JsonResponse
    {
        abort_unless($timeEntry->tenant_id === $this->tenantId($request), 404);

        $validated = $request->validate([
            'started_at' => 'sometimes|date',
            'ended_at' => 'nullable|date|after:started_at',
            'type' => ['sometimes', Rule::in(array_keys(TimeEntry::TYPES))],
            'description' => 'nullable|string',
        ]);

        try {
            $timeEntry->update($validated);
            return response()->json($timeEntry->fresh()->load(['technician:id,name', 'workOrder:id,number,os_number']));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('TimeEntry update failed', ['id' => $timeEntry->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar apontamento'], 500);
        }
    }

    public function destroy(Request $request, TimeEntry $timeEntry): JsonResponse
    {
        abort_unless($timeEntry->tenant_id === $this->tenantId($request), 404);

        try {
            DB::transaction(fn () => $timeEntry->delete());
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('TimeEntry destroy failed', ['id' => $timeEntry->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir apontamento'], 500);
        }
    }

    // Timer: inicia um apontamento (sem ended_at)
    public function start(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'work_order_id' => ['required', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'type' => ['sometimes', Rule::in(array_keys(TimeEntry::TYPES))],
            'description' => 'nullable|string',
        ]);

        if ($this->hasRunningEntry($tenantId, (int) $request->user()->id)) {
            return response()->json([
                'message' => 'Voce ja possui apontamento em andamento.',
            ], 409);
        }

        $entry = TimeEntry::create([
            ...$validated,
            'tenant_id' => $tenantId,
            'technician_id' => $request->user()->id,
            'started_at' => now(),
        ]);

        return response()->json($entry->load(['workOrder:id,number,os_number']), 201);
    }

    // Timer: finaliza apontamento em andamento
    public function stop(Request $request, TimeEntry $timeEntry): JsonResponse
    {
        abort_unless($timeEntry->tenant_id === $this->tenantId($request), 404);

        if ($timeEntry->ended_at) {
            return response()->json(['message' => 'Apontamento já finalizado'], 422);
        }

        // Verifica ownership — só o próprio técnico ou admin pode parar
        $user = $request->user();
        $canManageOthers = $user->hasRole(Role::SUPER_ADMIN) || $user->can('technicians.time_entry.update');
        if ($timeEntry->technician_id !== $user->id && !$canManageOthers) {
            return response()->json(['message' => 'Sem permissão para finalizar este apontamento'], 403);
        }

        $timeEntry->update(['ended_at' => now()]);
        return response()->json($timeEntry->fresh()->load(['workOrder:id,number,os_number']));
    }

    // Resumo de horas por técnico (dashboard)
    public function summary(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $from = $request->get('from', now()->startOfWeek()->toDateString());
        $to = $request->get('to', now()->endOfWeek()->toDateString());

        $entries = TimeEntry::selectRaw('technician_id, type, SUM(duration_minutes) as total_minutes, COUNT(*) as entries_count')
            ->where('tenant_id', $tenantId)
            ->whereBetween('started_at', [$from, "{$to} 23:59:59"])
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

