<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GeofenceLocation;
use App\Models\TimeClockAdjustment;
use App\Models\TimeClockEntry;
use App\Models\JourneyRule;
use App\Models\JourneyEntry;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\VacationBalance;
use App\Models\EmployeeDocument;
use App\Models\OnboardingTemplate;
use App\Models\OnboardingChecklist;
use App\Models\OnboardingChecklistItem;
use App\Services\TimeClockService;
use App\Services\JourneyCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class HRAdvancedController extends Controller
{
    public function __construct(
        private TimeClockService $timeClockService,
        private JourneyCalculationService $journeyService,
    ) {}

    // ═══════════════════════════════════════════════════════════════
    // WAVE 1: PONTO DIGITAL AVANÇADO
    // ═══════════════════════════════════════════════════════════════

    public function advancedClockIn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'type' => 'nullable|in:regular,overtime,travel',
            'liveness_score' => 'nullable|numeric|between:0,1',
            'clock_method' => 'nullable|in:selfie,qrcode,manual',
            'geofence_location_id' => 'nullable|exists:geofence_locations,id',
            'selfie' => 'nullable|string', // base64
            'device_info' => 'nullable|array',
            'work_order_id' => 'nullable|exists:work_orders,id',
        ]);

        $validated['ip_address'] = $request->ip();

        try {
            $entry = $this->timeClockService->clockIn($request->user(), $validated);

            $message = $entry->approval_status === 'pending'
                ? 'Ponto registrado — aguardando aprovação'
                : 'Ponto de entrada registrado com sucesso';

            return response()->json([
                'message' => $message,
                'data' => $entry->load('geofenceLocation'),
            ], 201);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            Log::error('Advanced clock-in failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao registrar ponto'], 500);
        }
    }

    public function advancedClockOut(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $entry = $this->timeClockService->clockOut($request->user(), $validated);
            return response()->json(['message' => 'Ponto de saída registrado', 'data' => $entry]);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            Log::error('Advanced clock-out failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar saída'], 500);
        }
    }

    public function currentClockStatus(Request $request): JsonResponse
    {
        $entry = TimeClockEntry::where('user_id', $request->user()->id)
            ->whereNull('clock_out')
            ->with('geofenceLocation')
            ->first();

        return response()->json(['data' => $entry]);
    }

    public function approveClockEntry(Request $request, int $id): JsonResponse
    {
        try {
            $entry = $this->timeClockService->approveClockEntry($id, $request->user());
            return response()->json(['message' => 'Ponto aprovado', 'data' => $entry]);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function rejectClockEntry(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(['reason' => 'required|string|max:500']);
        try {
            $entry = $this->timeClockService->rejectClockEntry($id, $request->user(), $validated['reason']);
            return response()->json(['message' => 'Ponto rejeitado', 'data' => $entry]);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function pendingClockEntries(Request $request): JsonResponse
    {
        $entries = TimeClockEntry::where('tenant_id', $request->user()->tenant_id)
            ->where('approval_status', 'pending')
            ->with('user:id,name')
            ->orderByDesc('clock_in')
            ->paginate($request->input('per_page', 20));

        return response()->json($entries);
    }

    // ─── GEOFENCE ───────────────────────────────────────────────

    public function indexGeofences(Request $request): JsonResponse
    {
        $query = GeofenceLocation::where('tenant_id', $request->user()->tenant_id);
        if ($request->boolean('active_only')) $query->active();

        return response()->json($query->orderBy('name')->paginate($request->input('per_page', 50)));
    }

    public function storeGeofence(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'radius_meters' => 'required|integer|min:50|max:5000',
            'is_active' => 'boolean',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $geofence = GeofenceLocation::create($validated);
            DB::commit();
            return response()->json(['message' => 'Geofence criado', 'data' => $geofence], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Geofence create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar geofence'], 500);
        }
    }

    public function updateGeofence(Request $request, GeofenceLocation $geofence): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'latitude' => 'sometimes|numeric|between:-90,90',
            'longitude' => 'sometimes|numeric|between:-180,180',
            'radius_meters' => 'sometimes|integer|min:50|max:5000',
            'is_active' => 'boolean',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            DB::beginTransaction();
            $geofence->update($validated);
            DB::commit();
            return response()->json(['message' => 'Geofence atualizado', 'data' => $geofence->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar geofence'], 500);
        }
    }

    public function destroyGeofence(GeofenceLocation $geofence): JsonResponse
    {
        $geofence->delete();
        return response()->json(['message' => 'Geofence removido']);
    }

    // ─── TIME CLOCK ADJUSTMENTS ─────────────────────────────────

    public function indexAdjustments(Request $request): JsonResponse
    {
        $query = TimeClockAdjustment::where('tenant_id', $request->user()->tenant_id)
            ->with(['requester:id,name', 'approver:id,name', 'entry:id,clock_in,clock_out']);

        if ($request->filled('status')) $query->where('status', $request->status);

        return response()->json($query->orderByDesc('created_at')->paginate($request->input('per_page', 20)));
    }

    public function storeAdjustment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'time_clock_entry_id' => 'required|exists:time_clock_entries,id',
            'adjusted_clock_in' => 'nullable|date',
            'adjusted_clock_out' => 'nullable|date',
            'reason' => 'required|string|max:500',
        ]);

        try {
            $adjustment = $this->timeClockService->requestAdjustment($request->user(), $validated['time_clock_entry_id'], $validated);
            return response()->json(['message' => 'Ajuste solicitado', 'data' => $adjustment], 201);
        } catch (\Exception $e) {
            Log::error('Adjustment request failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao solicitar ajuste'], 500);
        }
    }

    public function approveAdjustment(Request $request, int $id): JsonResponse
    {
        try {
            $adjustment = $this->timeClockService->approveAdjustment($id, $request->user());
            return response()->json(['message' => 'Ajuste aprovado', 'data' => $adjustment]);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            Log::error('Adjustment approval failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao aprovar ajuste'], 500);
        }
    }

    public function rejectAdjustment(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(['reason' => 'required|string|max:500']);
        try {
            $adjustment = $this->timeClockService->rejectAdjustment($id, $request->user(), $validated['reason']);
            return response()->json(['message' => 'Ajuste rejeitado', 'data' => $adjustment]);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // WAVE 1: JORNADA & BANCO DE HORAS
    // ═══════════════════════════════════════════════════════════════

    public function indexJourneyRules(Request $request): JsonResponse
    {
        return response()->json(
            JourneyRule::where('tenant_id', $request->user()->tenant_id)->get()
        );
    }

    public function storeJourneyRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'daily_hours' => 'required|numeric|min:1|max:24',
            'weekly_hours' => 'required|numeric|min:1|max:168',
            'overtime_weekday_pct' => 'required|integer|min:0|max:200',
            'overtime_weekend_pct' => 'required|integer|min:0|max:200',
            'overtime_holiday_pct' => 'required|integer|min:0|max:200',
            'night_shift_pct' => 'nullable|integer|min:0|max:100',
            'night_start' => 'nullable|date_format:H:i',
            'night_end' => 'nullable|date_format:H:i',
            'uses_hour_bank' => 'boolean',
            'hour_bank_expiry_months' => 'nullable|integer|min:1|max:24',
            'is_default' => 'boolean',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;

            // If setting as default, unset previous defaults
            if (!empty($validated['is_default'])) {
                JourneyRule::where('tenant_id', $validated['tenant_id'])->update(['is_default' => false]);
            }

            $rule = JourneyRule::create($validated);
            DB::commit();
            return response()->json(['message' => 'Regra de jornada criada', 'data' => $rule], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Journey rule create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar regra'], 500);
        }
    }

    public function updateJourneyRule(Request $request, JourneyRule $rule): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'daily_hours' => 'sometimes|numeric|min:1|max:24',
            'weekly_hours' => 'sometimes|numeric|min:1|max:168',
            'overtime_weekday_pct' => 'sometimes|integer|min:0|max:200',
            'overtime_weekend_pct' => 'sometimes|integer|min:0|max:200',
            'overtime_holiday_pct' => 'sometimes|integer|min:0|max:200',
            'night_shift_pct' => 'nullable|integer|min:0|max:100',
            'uses_hour_bank' => 'boolean',
            'is_default' => 'boolean',
        ]);

        try {
            DB::beginTransaction();
            if (!empty($validated['is_default'])) {
                JourneyRule::where('tenant_id', $rule->tenant_id)->where('id', '!=', $rule->id)->update(['is_default' => false]);
            }
            $rule->update($validated);
            DB::commit();
            return response()->json(['message' => 'Regra atualizada', 'data' => $rule->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar regra'], 500);
        }
    }

    public function calculateJourney(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'year_month' => 'required|date_format:Y-m',
        ]);

        try {
            $this->journeyService->calculateMonth($validated['user_id'], $validated['year_month'], $request->user()->tenant_id);
            $summary = $this->journeyService->getMonthSummary($validated['user_id'], $validated['year_month']);
            return response()->json(['message' => 'Jornada calculada', 'data' => $summary]);
        } catch (\Exception $e) {
            Log::error('Journey calculation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao calcular jornada'], 500);
        }
    }

    public function journeyEntries(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'year_month' => 'required|date_format:Y-m',
        ]);

        $entries = JourneyEntry::forMonth($validated['user_id'], $validated['year_month'])
            ->with('journeyRule:id,name')
            ->orderBy('date')
            ->get();

        $summary = $this->journeyService->getMonthSummary($validated['user_id'], $validated['year_month']);

        return response()->json(['data' => $entries, 'summary' => $summary]);
    }

    public function hourBankBalance(Request $request): JsonResponse
    {
        $userId = $request->input('user_id', $request->user()->id);
        $balance = $this->journeyService->getHourBankBalance($userId);
        return response()->json(['data' => ['user_id' => $userId, 'balance' => $balance]]);
    }

    // ─── HOLIDAYS ───────────────────────────────────────────────

    public function indexHolidays(Request $request): JsonResponse
    {
        $query = Holiday::where('tenant_id', $request->user()->tenant_id);
        if ($request->filled('year')) $query->whereYear('date', $request->year);

        return response()->json($query->orderBy('date')->get());
    }

    public function storeHoliday(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'date' => 'required|date',
            'is_national' => 'boolean',
            'is_recurring' => 'boolean',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $holiday = Holiday::create($validated);
            DB::commit();
            return response()->json(['message' => 'Feriado cadastrado', 'data' => $holiday], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao cadastrar feriado'], 500);
        }
    }

    public function destroyHoliday(Holiday $holiday): JsonResponse
    {
        $holiday->delete();
        return response()->json(['message' => 'Feriado removido']);
    }

    // ═══════════════════════════════════════════════════════════════
    // WAVE 2: FÉRIAS & AFASTAMENTOS
    // ═══════════════════════════════════════════════════════════════

    public function indexLeaves(Request $request): JsonResponse
    {
        $query = LeaveRequest::where('tenant_id', $request->user()->tenant_id)
            ->with('user:id,name');

        if ($request->filled('user_id')) $query->where('user_id', $request->user_id);
        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('type')) $query->where('type', $request->type);

        return response()->json($query->orderByDesc('start_date')->paginate($request->input('per_page', 20)));
    }

    public function storeLeave(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'type' => 'required|in:vacation,medical,personal,maternity,paternity,bereavement,other',
            'start_date' => 'required|date|after_or_equal:today',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'nullable|string|max:500',
            'document_path' => 'nullable|string',
        ]);

        // Check for overlapping leaves
        $overlap = LeaveRequest::overlapping($validated['user_id'], $validated['start_date'], $validated['end_date'])->exists();
        if ($overlap) {
            return response()->json(['message' => 'Já existe afastamento neste período'], 422);
        }

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $validated['days_count'] = \Carbon\Carbon::parse($validated['start_date'])
                ->diffInDays(\Carbon\Carbon::parse($validated['end_date'])) + 1;
            $validated['status'] = 'pending';

            $leave = LeaveRequest::create($validated);
            DB::commit();
            return response()->json(['message' => 'Afastamento solicitado', 'data' => $leave], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Leave request failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao solicitar afastamento'], 500);
        }
    }

    public function approveLeave(Request $request, LeaveRequest $leave): JsonResponse
    {
        if ($leave->status !== 'pending') {
            return response()->json(['message' => 'Afastamento não está pendente'], 422);
        }

        try {
            DB::beginTransaction();
            $leave->update([
                'status' => 'approved',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);

            // If vacation, update balance
            if ($leave->type === 'vacation') {
                $balance = VacationBalance::where('user_id', $leave->user_id)
                    ->where('status', 'available')
                    ->first();
                if ($balance) {
                    $balance->increment('taken_days', $leave->days_count);
                    if ($balance->remaining_days <= 0) {
                        $balance->update(['status' => 'taken']);
                    } else {
                        $balance->update(['status' => 'partially_taken']);
                    }
                }
            }

            DB::commit();
            return response()->json(['message' => 'Afastamento aprovado', 'data' => $leave->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao aprovar'], 500);
        }
    }

    public function rejectLeave(Request $request, LeaveRequest $leave): JsonResponse
    {
        $validated = $request->validate(['reason' => 'required|string|max:500']);

        if ($leave->status !== 'pending') {
            return response()->json(['message' => 'Afastamento não está pendente'], 422);
        }

        $leave->update([
            'status' => 'rejected',
            'approved_by' => $request->user()->id,
            'rejection_reason' => $validated['reason'],
        ]);

        return response()->json(['message' => 'Afastamento rejeitado', 'data' => $leave->fresh()]);
    }

    public function vacationBalances(Request $request): JsonResponse
    {
        $query = VacationBalance::where('tenant_id', $request->user()->tenant_id)
            ->with('user:id,name');

        if ($request->filled('user_id')) $query->where('user_id', $request->user_id);

        return response()->json($query->orderByDesc('acquisition_start')->paginate($request->input('per_page', 20)));
    }

    // ═══════════════════════════════════════════════════════════════
    // WAVE 2: DOCUMENTOS DO COLABORADOR
    // ═══════════════════════════════════════════════════════════════

    public function indexDocuments(Request $request): JsonResponse
    {
        $query = EmployeeDocument::where('tenant_id', $request->user()->tenant_id)
            ->with('user:id,name');

        if ($request->filled('user_id')) $query->where('user_id', $request->user_id);
        if ($request->filled('category')) $query->where('category', $request->category);
        if ($request->boolean('expiring')) $query->expiring(30);

        return response()->json($query->orderByDesc('created_at')->paginate($request->input('per_page', 20)));
    }

    public function storeDocument(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'category' => 'required|in:aso,nr,contract,license,certification,id_doc,other',
            'name' => 'required|string|max:255',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png|max:10240',
            'expiry_date' => 'nullable|date',
            'issued_date' => 'nullable|date',
            'issuer' => 'nullable|string|max:255',
            'is_mandatory' => 'boolean',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            DB::beginTransaction();
            $file = $request->file('file');
            $path = $file->store("hr/documents/{$validated['user_id']}", 'local');

            $doc = EmployeeDocument::create([
                'tenant_id' => $request->user()->tenant_id,
                'user_id' => $validated['user_id'],
                'category' => $validated['category'],
                'name' => $validated['name'],
                'file_path' => $path,
                'expiry_date' => $validated['expiry_date'] ?? null,
                'issued_date' => $validated['issued_date'] ?? null,
                'issuer' => $validated['issuer'] ?? null,
                'is_mandatory' => $validated['is_mandatory'] ?? false,
                'status' => 'valid',
                'notes' => $validated['notes'] ?? null,
                'uploaded_by' => $request->user()->id,
            ]);

            DB::commit();
            return response()->json(['message' => 'Documento enviado', 'data' => $doc], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Document upload failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao enviar documento'], 500);
        }
    }

    public function destroyDocument(EmployeeDocument $document): JsonResponse
    {
        \Illuminate\Support\Facades\Storage::disk('local')->delete($document->file_path);
        $document->delete();
        return response()->json(['message' => 'Documento removido']);
    }

    public function expiringDocuments(Request $request): JsonResponse
    {
        $days = $request->input('days', 30);
        $docs = EmployeeDocument::where('tenant_id', $request->user()->tenant_id)
            ->expiring($days)
            ->with('user:id,name')
            ->orderBy('expiry_date')
            ->get();

        return response()->json(['data' => $docs]);
    }

    // ═══════════════════════════════════════════════════════════════
    // WAVE 2: ONBOARDING / OFFBOARDING
    // ═══════════════════════════════════════════════════════════════

    public function indexTemplates(Request $request): JsonResponse
    {
        $query = OnboardingTemplate::where('tenant_id', $request->user()->tenant_id);
        if ($request->filled('type')) $query->where('type', $request->type);
        return response()->json($query->orderBy('name')->get());
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:admission,dismissal',
            'default_tasks' => 'nullable|array',
            'default_tasks.*.title' => 'required|string|max:255',
            'default_tasks.*.description' => 'nullable|string|max:500',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $template = OnboardingTemplate::create($validated);
            DB::commit();
            return response()->json(['message' => 'Template criado', 'data' => $template], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao criar template'], 500);
        }
    }

    public function startOnboarding(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'template_id' => 'required|exists:onboarding_templates,id',
        ]);

        try {
            DB::beginTransaction();
            $template = OnboardingTemplate::findOrFail($validated['template_id']);

            $checklist = OnboardingChecklist::create([
                'tenant_id' => $request->user()->tenant_id,
                'user_id' => $validated['user_id'],
                'onboarding_template_id' => $template->id,
                'started_at' => now(),
                'status' => 'in_progress',
            ]);

            // Create items from template
            foreach ($template->default_tasks ?? [] as $i => $task) {
                OnboardingChecklistItem::create([
                    'onboarding_checklist_id' => $checklist->id,
                    'title' => $task['title'],
                    'description' => $task['description'] ?? null,
                    'order' => $i,
                ]);
            }

            DB::commit();
            return response()->json(['message' => 'Onboarding iniciado', 'data' => $checklist->load('items')], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Onboarding start failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao iniciar onboarding'], 500);
        }
    }

    public function indexChecklists(Request $request): JsonResponse
    {
        $query = OnboardingChecklist::where('tenant_id', $request->user()->tenant_id)
            ->with(['user:id,name', 'template:id,name,type', 'items']);

        if ($request->filled('status')) $query->where('status', $request->status);

        return response()->json($query->orderByDesc('created_at')->paginate($request->input('per_page', 20)));
    }

    public function completeChecklistItem(Request $request, int $itemId): JsonResponse
    {
        $item = OnboardingChecklistItem::findOrFail($itemId);

        $item->update([
            'is_completed' => true,
            'completed_at' => now(),
            'completed_by' => $request->user()->id,
        ]);

        // Check if all items are done
        $checklist = $item->checklist;
        $allDone = $checklist->items()->where('is_completed', false)->doesntExist();
        if ($allDone) {
            $checklist->update(['status' => 'completed', 'completed_at' => now()]);
        }

        return response()->json([
            'message' => $allDone ? 'Onboarding concluído!' : 'Item marcado como concluído',
            'data' => $checklist->fresh()->load('items'),
        ]);
    }

    // ═══════════════════════════════════════════════════════════════
    // DASHBOARD EXPANDIDO
    // ═══════════════════════════════════════════════════════════════

    public function advancedDashboard(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $pendingClockApprovals = TimeClockEntry::where('tenant_id', $tenantId)
            ->where('approval_status', 'pending')->count();

        $pendingAdjustments = TimeClockAdjustment::where('tenant_id', $tenantId)
            ->where('status', 'pending')->count();

        $pendingLeaves = LeaveRequest::where('tenant_id', $tenantId)
            ->where('status', 'pending')->count();

        $expiringDocs = EmployeeDocument::where('tenant_id', $tenantId)
            ->expiring(30)->count();

        $expiredDocs = EmployeeDocument::where('tenant_id', $tenantId)
            ->expired()->count();

        $activeOnboardings = OnboardingChecklist::where('tenant_id', $tenantId)
            ->where('status', 'in_progress')->count();

        $activeClocksToday = TimeClockEntry::where('tenant_id', $tenantId)
            ->whereDate('clock_in', today())
            ->whereNull('clock_out')
            ->count();

        return response()->json(['data' => [
            'pending_clock_approvals' => $pendingClockApprovals,
            'pending_adjustments' => $pendingAdjustments,
            'pending_leaves' => $pendingLeaves,
            'expiring_documents' => $expiringDocs,
            'expired_documents' => $expiredDocs,
            'active_onboardings' => $activeOnboardings,
            'active_clocks_today' => $activeClocksToday,
        ]]);
    }
}
