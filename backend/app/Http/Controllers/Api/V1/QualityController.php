<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\QualityProcedure;
use App\Models\CorrectiveAction;
use App\Models\CustomerComplaint;
use App\Models\SatisfactionSurvey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class QualityController extends Controller
{
    // ─── PROCEDURES ──────────────────────────────────────────────

    public function indexProcedures(Request $request): JsonResponse
    {
        $query = QualityProcedure::where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('category')) $query->where('category', $request->category);
        if ($request->filled('search')) {
            $query->where(fn($q) => $q->where('title', 'like', "%{$request->search}%")
                ->orWhere('code', 'like', "%{$request->search}%"));
        }

        return response()->json($query->orderBy('code')->paginate($request->input('per_page', 20)));
    }

    public function storeProcedure(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:30',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'category' => 'nullable|in:calibration,safety,operational,management',
            'content' => 'nullable|string',
            'next_review_date' => 'nullable|date',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $procedure = QualityProcedure::create($validated);
            DB::commit();
            return response()->json(['message' => 'Procedimento criado', 'data' => $procedure], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('QualityProcedure create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar procedimento'], 500);
        }
    }

    public function showProcedure(QualityProcedure $procedure): JsonResponse
    {
        $procedure->load('approver:id,name');
        return response()->json(['data' => $procedure]);
    }

    public function updateProcedure(Request $request, QualityProcedure $procedure): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'category' => 'nullable|in:calibration,safety,operational,management',
            'content' => 'nullable|string',
            'next_review_date' => 'nullable|date',
            'status' => 'nullable|in:draft,active,obsolete',
        ]);

        try {
            DB::beginTransaction();
            if (isset($validated['content']) && $validated['content'] !== $procedure->content) {
                $validated['revision'] = $procedure->revision + 1;
            }
            $procedure->update($validated);
            DB::commit();
            return response()->json(['message' => 'Procedimento atualizado', 'data' => $procedure->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar procedimento'], 500);
        }
    }

    public function approveProcedure(Request $request, QualityProcedure $procedure): JsonResponse
    {
        try {
            DB::beginTransaction();
            $procedure->update([
                'status' => 'active',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);
            DB::commit();
            return response()->json(['message' => 'Procedimento aprovado', 'data' => $procedure->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao aprovar'], 500);
        }
    }

    public function destroyProcedure(QualityProcedure $procedure): JsonResponse
    {
        if ($procedure->status === 'active') {
            return response()->json(['message' => 'Procedimentos ativos não podem ser excluídos. Mude para obsoleto primeiro.'], 422);
        }

        try {
            $procedure->delete();
            return response()->json(['message' => 'Procedimento excluído com sucesso']);
        } catch (\Exception $e) {
            Log::error('QualityProcedure delete failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir procedimento'], 500);
        }
    }

    // ─── CORRECTIVE ACTIONS ──────────────────────────────────────

    public function indexCorrectiveActions(Request $request): JsonResponse
    {
        $query = CorrectiveAction::where('tenant_id', $request->user()->tenant_id)
            ->with('responsible:id,name');

        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('type')) $query->where('type', $request->type);

        return response()->json($query->orderByDesc('created_at')->paginate($request->input('per_page', 20)));
    }

    public function storeCorrectiveAction(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|in:corrective,preventive',
            'source' => 'required|in:calibration,complaint,audit,internal',
            'sourceable_type' => 'nullable|string',
            'sourceable_id' => 'nullable|integer',
            'nonconformity_description' => 'required|string',
            'root_cause' => 'nullable|string',
            'action_plan' => 'nullable|string',
            'responsible_id' => 'nullable|exists:users,id',
            'deadline' => 'nullable|date',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $action = CorrectiveAction::create($validated);
            DB::commit();
            return response()->json(['message' => 'Ação registrada', 'data' => $action], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('CorrectiveAction create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar ação'], 500);
        }
    }

    public function updateCorrectiveAction(Request $request, CorrectiveAction $action): JsonResponse
    {
        $validated = $request->validate([
            'root_cause' => 'nullable|string',
            'action_plan' => 'nullable|string',
            'responsible_id' => 'nullable|exists:users,id',
            'deadline' => 'nullable|date',
            'status' => 'nullable|in:open,in_progress,completed,verified',
            'verification_notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            if (($validated['status'] ?? null) === 'completed') {
                $validated['completed_at'] = now();
            }
            $action->update($validated);
            DB::commit();
            return response()->json(['message' => 'Ação atualizada', 'data' => $action->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar ação'], 500);
        }
    }

    public function destroyCorrectiveAction(CorrectiveAction $action): JsonResponse
    {
        if (in_array($action->status, ['completed', 'verified'])) {
            return response()->json(['message' => 'Ações concluídas ou verificadas não podem ser excluídas'], 422);
        }

        try {
            $action->delete();
            return response()->json(['message' => 'Ação corretiva excluída com sucesso']);
        } catch (\Exception $e) {
            Log::error('CorrectiveAction delete failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir ação corretiva'], 500);
        }
    }

    // ─── CUSTOMER COMPLAINTS ─────────────────────────────────────

    public function indexComplaints(Request $request): JsonResponse
    {
        $query = CustomerComplaint::where('tenant_id', $request->user()->tenant_id)
            ->with(['customer:id,name', 'assignedTo:id,name']);

        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('severity')) $query->where('severity', $request->severity);

        return response()->json($query->orderByDesc('created_at')->paginate($request->input('per_page', 20)));
    }

    public function storeComplaint(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'equipment_id' => 'nullable|exists:equipments,id',
            'description' => 'required|string',
            'category' => 'nullable|in:service,certificate,delay,billing,other',
            'severity' => 'nullable|in:low,medium,high,critical',
            'assigned_to' => 'nullable|exists:users,id',
            'response_due_at' => 'nullable|date',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $complaint = CustomerComplaint::create($validated);
            DB::commit();
            return response()->json(['message' => 'Reclamação registrada', 'data' => $complaint], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao registrar reclamação'], 500);
        }
    }

    public function updateComplaint(Request $request, CustomerComplaint $complaint): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'nullable|in:open,investigating,resolved,closed',
            'resolution' => 'nullable|string',
            'assigned_to' => 'nullable|exists:users,id',
            'response_due_at' => 'nullable|date',
            'responded_at' => 'nullable|date',
        ]);

        try {
            DB::beginTransaction();
            if (($validated['status'] ?? null) === 'resolved') {
                $validated['resolved_at'] = now();
                if (empty($complaint->responded_at)) {
                    $validated['responded_at'] = now();
                }
            }
            $complaint->update($validated);
            DB::commit();
            return response()->json(['message' => 'Reclamação atualizada', 'data' => $complaint->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar reclamação'], 500);
        }
    }

    public function destroyComplaint(CustomerComplaint $complaint): JsonResponse
    {
        if (in_array($complaint->status, ['resolved', 'closed'])) {
            return response()->json(['message' => 'Reclamações resolvidas ou fechadas não podem ser excluídas'], 422);
        }

        try {
            $complaint->delete();
            return response()->json(['message' => 'Reclamação excluída com sucesso']);
        } catch (\Exception $e) {
            Log::error('CustomerComplaint delete failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir reclamação'], 500);
        }
    }

    // ─── SATISFACTION SURVEYS / NPS ──────────────────────────────

    public function indexSurveys(Request $request): JsonResponse
    {
        $query = SatisfactionSurvey::where('tenant_id', $request->user()->tenant_id)
            ->with(['customer:id,name', 'workOrder:id,number']);

        return response()->json($query->orderByDesc('created_at')->paginate($request->input('per_page', 20)));
    }

    public function storeSurvey(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'nps_score' => 'nullable|integer|min:0|max:10',
            'service_rating' => 'nullable|integer|min:1|max:5',
            'technician_rating' => 'nullable|integer|min:1|max:5',
            'timeliness_rating' => 'nullable|integer|min:1|max:5',
            'comment' => 'nullable|string',
            'channel' => 'nullable|in:system,whatsapp,email,phone',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $survey = SatisfactionSurvey::create($validated);
            DB::commit();
            return response()->json(['message' => 'Pesquisa registrada', 'data' => $survey], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao registrar pesquisa'], 500);
        }
    }

    public function npsDashboard(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $surveys = SatisfactionSurvey::where('tenant_id', $tenantId)
            ->whereNotNull('nps_score');

        $total = $surveys->count();
        if ($total === 0) {
            return response()->json(['data' => ['nps' => null, 'total' => 0]]);
        }

        $promoters = (clone $surveys)->where('nps_score', '>=', 9)->count();
        $detractors = (clone $surveys)->where('nps_score', '<=', 6)->count();
        $nps = round((($promoters - $detractors) / $total) * 100, 1);

        $avgRatings = SatisfactionSurvey::where('tenant_id', $tenantId)
            ->selectRaw('AVG(service_rating) as avg_service, AVG(technician_rating) as avg_technician, AVG(timeliness_rating) as avg_timeliness')
            ->first();

        return response()->json(['data' => [
            'nps' => $nps,
            'total' => $total,
            'promoters' => $promoters,
            'passives' => $total - $promoters - $detractors,
            'detractors' => $detractors,
            'avg_service' => round($avgRatings->avg_service ?? 0, 1),
            'avg_technician' => round($avgRatings->avg_technician ?? 0, 1),
            'avg_timeliness' => round($avgRatings->avg_timeliness ?? 0, 1),
        ]]);
    }

    // ─── QUALITY DASHBOARD ───────────────────────────────────────

    public function dashboard(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        return response()->json(['data' => [
            'active_procedures' => QualityProcedure::where('tenant_id', $tenantId)->where('status', 'active')->count(),
            'review_due' => QualityProcedure::where('tenant_id', $tenantId)->where('next_review_date', '<=', now()->addMonth())->count(),
            'open_actions' => CorrectiveAction::where('tenant_id', $tenantId)->whereIn('status', ['open', 'in_progress'])->count(),
            'overdue_actions' => CorrectiveAction::where('tenant_id', $tenantId)->whereIn('status', ['open', 'in_progress'])->where('deadline', '<', now())->count(),
            'open_complaints' => CustomerComplaint::where('tenant_id', $tenantId)->whereIn('status', ['open', 'investigating'])->count(),
            'total_surveys' => SatisfactionSurvey::where('tenant_id', $tenantId)->count(),
        ]]);
    }
}
