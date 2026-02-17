<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Models\WorkSchedule;
use App\Models\TimeClockEntry;
use App\Models\Training;
use App\Models\Role;
use App\Models\User;
use App\Models\PerformanceReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class HRController extends Controller
{
    use ResolvesCurrentTenant;
    // ─── WORK SCHEDULES ──────────────────────────────────────────

    public function indexSchedules(Request $request): JsonResponse
    {
        $query = WorkSchedule::where('tenant_id', $this->resolvedTenantId())
            ->with('user:id,name');

        if ($request->filled('user_id')) $query->where('user_id', $request->user_id);
        if ($request->filled('date_from')) $query->where('date', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->where('date', '<=', $request->date_to);

        return response()->json($query->orderBy('date')->paginate($request->input('per_page', 50)));
    }

    public function storeSchedule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
            'shift_type' => 'nullable|in:normal,overtime,off,vacation,sick',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'region' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $this->resolvedTenantId();
            $schedule = WorkSchedule::updateOrCreate(
                ['user_id' => $validated['user_id'], 'date' => $validated['date']],
                $validated
            );
            DB::commit();
            return response()->json(['message' => 'Escala salva com sucesso', 'data' => $schedule], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkSchedule create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao salvar escala'], 500);
        }
    }

    public function batchSchedule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'schedules' => 'required|array|min:1',
            'schedules.*.user_id' => 'required|exists:users,id',
            'schedules.*.date' => 'required|date',
            'schedules.*.shift_type' => 'nullable|in:normal,overtime,off,vacation,sick',
            'schedules.*.start_time' => 'nullable|date_format:H:i',
            'schedules.*.end_time' => 'nullable|date_format:H:i',
            'schedules.*.region' => 'nullable|string|max:100',
        ]);

        try {
            DB::beginTransaction();
            $tenantId = $this->resolvedTenantId();
            foreach ($validated['schedules'] as $data) {
                $data['tenant_id'] = $tenantId;
                WorkSchedule::updateOrCreate(
                    ['user_id' => $data['user_id'], 'date' => $data['date']],
                    $data
                );
            }
            DB::commit();
            return response()->json(['message' => count($validated['schedules']) . ' escalas salvas']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao salvar escalas em lote'], 500);
        }
    }

    // ─── TIME CLOCK ──────────────────────────────────────────────

    public function clockIn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'type' => 'nullable|in:regular,overtime,travel',
        ]);

        $openEntry = TimeClockEntry::where('user_id', $request->user()->id)
            ->whereNull('clock_out')
            ->first();

        if ($openEntry) {
            return response()->json(['message' => 'Já existe um ponto aberto. Registre a saída primeiro.'], 422);
        }

        try {
            DB::beginTransaction();
            $entry = TimeClockEntry::create([
                'tenant_id' => $this->resolvedTenantId(),
                'user_id' => $request->user()->id,
                'clock_in' => now(),
                'latitude_in' => $validated['latitude'] ?? null,
                'longitude_in' => $validated['longitude'] ?? null,
                'type' => $validated['type'] ?? 'regular',
            ]);
            DB::commit();
            return response()->json(['message' => 'Ponto de entrada registrado', 'data' => $entry], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao registrar ponto'], 500);
        }
    }

    public function clockOut(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'notes' => 'nullable|string',
        ]);

        $openEntry = TimeClockEntry::where('user_id', $request->user()->id)
            ->whereNull('clock_out')
            ->first();

        if (!$openEntry) {
            return response()->json(['message' => 'Nenhum ponto aberto encontrado.'], 422);
        }

        try {
            DB::beginTransaction();
            $openEntry->update([
                'clock_out' => now(),
                'latitude_out' => $validated['latitude'] ?? null,
                'longitude_out' => $validated['longitude'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);
            DB::commit();
            return response()->json(['message' => 'Ponto de saída registrado', 'data' => $openEntry->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao registrar saída'], 500);
        }
    }

    public function myClockHistory(Request $request): JsonResponse
    {
        return response()->json(
            TimeClockEntry::where('user_id', $request->user()->id)
                ->orderByDesc('clock_in')
                ->paginate($request->input('per_page', 30))
        );
    }

    public function allClockEntries(Request $request): JsonResponse
    {
        $query = TimeClockEntry::where('tenant_id', $this->resolvedTenantId())
            ->with('user:id,name');

        if ($request->filled('user_id')) $query->where('user_id', $request->user_id);
        if ($request->filled('date_from')) $query->whereDate('clock_in', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('clock_in', '<=', $request->date_to);

        return response()->json($query->orderByDesc('clock_in')->paginate($request->input('per_page', 50)));
    }

    // ─── TRAININGS ───────────────────────────────────────────────

    public function indexTrainings(Request $request): JsonResponse
    {
        $query = Training::where('tenant_id', $this->resolvedTenantId())
            ->with('user:id,name');

        if ($request->filled('user_id')) $query->where('user_id', $request->user_id);
        if ($request->filled('category')) $query->where('category', $request->category);

        return response()->json($query->orderByDesc('completion_date')->paginate($request->input('per_page', 20)));
    }

    public function storeTraining(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'title' => 'required|string|max:255',
            'institution' => 'nullable|string|max:255',
            'certificate_number' => 'nullable|string|max:100',
            'completion_date' => 'nullable|date',
            'expiry_date' => 'nullable|date',
            'category' => 'nullable|in:technical,safety,quality,management',
            'hours' => 'nullable|integer|min:1',
            'status' => 'nullable|in:planned,in_progress,completed,expired',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $this->resolvedTenantId();
            $training = Training::create($validated);
            DB::commit();
            return response()->json(['message' => 'Treinamento registrado', 'data' => $training], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao registrar treinamento'], 500);
        }
    }

    public function updateTraining(Request $request, Training $training): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'institution' => 'nullable|string|max:255',
            'certificate_number' => 'nullable|string|max:100',
            'completion_date' => 'nullable|date',
            'expiry_date' => 'nullable|date',
            'category' => 'nullable|in:technical,safety,quality,management',
            'hours' => 'nullable|integer|min:1',
            'status' => 'nullable|in:planned,in_progress,completed,expired',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $training->update($validated);
            DB::commit();
            return response()->json(['message' => 'Treinamento atualizado', 'data' => $training->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar treinamento'], 500);
        }
    }

    public function showTraining(Training $training): JsonResponse
    {
        $training->load('user:id,name');
        return response()->json(['data' => $training]);
    }

    public function destroyTraining(Training $training): JsonResponse
    {
        try {
            $training->delete();
            return response()->json(['message' => 'Treinamento excluído com sucesso']);
        } catch (\Exception $e) {
            Log::error('Training delete failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir treinamento'], 500);
        }
    }

    // ─── PERFORMANCE REVIEWS ─────────────────────────────────────

    // Performance Review methods moved to PerformanceReviewController

    // ─── HR DASHBOARD ────────────────────────────────────────────

    public function dashboard(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $expiringTrainings = Training::where('tenant_id', $tenantId)
            ->whereNotNull('expiry_date')
            ->where('expiry_date', '<=', now()->addMonth())
            ->where('status', '!=', 'expired')
            ->count();

        $activeClocks = TimeClockEntry::where('tenant_id', $tenantId)
            ->whereNull('clock_out')
            ->count();

        $pendingReviews = PerformanceReview::where('tenant_id', $tenantId)
            ->where('status', 'draft')
            ->count();

        $totalTechnicians = User::where('tenant_id', $tenantId)
            ->whereHas('roles', function($q) {
                $q->where('name', Role::TECNICO);
            })
            ->count();

        return response()->json(['data' => [
            'expiring_trainings' => $expiringTrainings,
            'trainings_due' => $expiringTrainings, // Frontend alias
            'active_clocks' => $activeClocks,
            'clocked_in_today' => $activeClocks, // Frontend alias (approximate)
            'pending_reviews' => $pendingReviews,
            'total_technicians' => $totalTechnicians,
        ]]);
    }
}
