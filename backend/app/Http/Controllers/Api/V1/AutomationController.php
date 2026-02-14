<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AutomationRule;
use App\Models\Webhook;
use App\Models\WebhookLog;
use App\Models\ScheduledReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutomationController extends Controller
{
    // ─── AUTOMATION RULES ────────────────────────────────────────

    public function indexRules(Request $request): JsonResponse
    {
        $query = AutomationRule::where('tenant_id', $request->user()->tenant_id);
        if ($request->boolean('active_only')) $query->where('is_active', true);

        return response()->json($query->orderBy('name')->paginate($request->input('per_page', 20)));
    }

    public function storeRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'trigger_event' => 'required|string|max:100',
            'conditions' => 'nullable|array',
            'actions' => 'required|array|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $validated['created_by'] = $request->user()->id;
            $rule = AutomationRule::create($validated);
            DB::commit();
            return response()->json(['message' => 'Automação criada', 'data' => $rule], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('AutomationRule create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar automação'], 500);
        }
    }

    public function updateRule(Request $request, AutomationRule $rule): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'trigger_event' => 'sometimes|string|max:100',
            'conditions' => 'nullable|array',
            'actions' => 'sometimes|array|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        try {
            DB::beginTransaction();
            $rule->update($validated);
            DB::commit();
            return response()->json(['message' => 'Automação atualizada', 'data' => $rule->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar'], 500);
        }
    }

    public function destroyRule(AutomationRule $rule): JsonResponse
    {
        try {
            DB::beginTransaction();
            $rule->delete();
            DB::commit();
            return response()->json(['message' => 'Automação removida']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao remover'], 500);
        }
    }

    public function availableEvents(): JsonResponse
    {
        return response()->json(['data' => [
            'work_order.created', 'work_order.completed', 'work_order.cancelled',
            'quote.created', 'quote.approved', 'quote.rejected', 'quote.expiring',
            'payment.received', 'payment.overdue',
            'certificate.generated', 'certificate.expiring',
            'customer.created', 'customer.inactive',
            'expense.created', 'expense.approved',
            'service_call.created', 'service_call.completed',
            'equipment.calibration_due',
        ]]);
    }

    public function availableActions(): JsonResponse
    {
        return response()->json(['data' => [
            ['type' => 'send_email', 'label' => 'Enviar e-mail', 'params' => ['to', 'subject', 'body']],
            ['type' => 'send_notification', 'label' => 'Enviar notificação push', 'params' => ['user_id', 'message']],
            ['type' => 'create_task', 'label' => 'Criar tarefa na central', 'params' => ['title', 'assigned_to']],
            ['type' => 'change_status', 'label' => 'Alterar status', 'params' => ['new_status']],
            ['type' => 'webhook', 'label' => 'Disparar webhook', 'params' => ['webhook_id']],
            ['type' => 'create_followup', 'label' => 'Agendar follow-up', 'params' => ['days_ahead', 'assigned_to']],
        ]]);
    }

    // ─── WEBHOOKS ────────────────────────────────────────────────

    public function indexWebhooks(Request $request): JsonResponse
    {
        return response()->json(
            Webhook::where('tenant_id', $request->user()->tenant_id)
                ->withCount('logs')
                ->orderBy('name')
                ->paginate($request->input('per_page', 20))
        );
    }

    public function storeWebhook(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'url' => 'required|url',
            'events' => 'required|array|min:1',
            'secret' => 'nullable|string|max:100',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $webhook = Webhook::create($validated);
            DB::commit();
            return response()->json(['message' => 'Webhook criado', 'data' => $webhook], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao criar webhook'], 500);
        }
    }

    public function updateWebhook(Request $request, Webhook $webhook): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'url' => 'sometimes|url',
            'events' => 'sometimes|array|min:1',
            'secret' => 'nullable|string|max:100',
            'is_active' => 'nullable|boolean',
        ]);

        try {
            DB::beginTransaction();
            $webhook->update($validated);
            DB::commit();
            return response()->json(['message' => 'Webhook atualizado', 'data' => $webhook->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar'], 500);
        }
    }

    public function destroyWebhook(Webhook $webhook): JsonResponse
    {
        try {
            DB::beginTransaction();
            $webhook->delete();
            DB::commit();
            return response()->json(['message' => 'Webhook removido']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao remover'], 500);
        }
    }

    public function webhookLogs(Request $request, Webhook $webhook): JsonResponse
    {
        return response()->json(
            $webhook->logs()->orderByDesc('created_at')->paginate($request->input('per_page', 50))
        );
    }

    // ─── SCHEDULED REPORTS ───────────────────────────────────────

    public function indexScheduledReports(Request $request): JsonResponse
    {
        return response()->json(
            ScheduledReport::where('tenant_id', $request->user()->tenant_id)
                ->with('creator:id,name')
                ->orderBy('report_type')
                ->paginate($request->input('per_page', 20))
        );
    }

    public function storeScheduledReport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'report_type' => 'required|in:financial,productivity,commissions,certificates,aging,fleet',
            'frequency' => 'required|in:daily,weekly,monthly',
            'recipients' => 'required|array|min:1',
            'recipients.*' => 'email',
            'filters' => 'nullable|array',
            'format' => 'nullable|in:pdf,excel',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $validated['created_by'] = $request->user()->id;
            $validated['next_send_at'] = now()->addDay();
            $report = ScheduledReport::create($validated);
            DB::commit();
            return response()->json(['message' => 'Relatório agendado', 'data' => $report], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao agendar relatório'], 500);
        }
    }

    public function updateScheduledReport(Request $request, ScheduledReport $report): JsonResponse
    {
        $validated = $request->validate([
            'frequency' => 'sometimes|in:daily,weekly,monthly',
            'recipients' => 'sometimes|array|min:1',
            'recipients.*' => 'email',
            'filters' => 'nullable|array',
            'format' => 'nullable|in:pdf,excel',
            'is_active' => 'nullable|boolean',
        ]);

        try {
            DB::beginTransaction();
            $report->update($validated);
            DB::commit();
            return response()->json(['message' => 'Relatório atualizado', 'data' => $report->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar'], 500);
        }
    }

    public function destroyScheduledReport(ScheduledReport $report): JsonResponse
    {
        try {
            DB::transaction(fn () => $report->delete());
            return response()->json(['message' => 'Relatório removido']);
        } catch (\Exception $e) {
            Log::error('ScheduledReport delete failed', ['id' => $report->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover'], 500);
        }
    }
}
