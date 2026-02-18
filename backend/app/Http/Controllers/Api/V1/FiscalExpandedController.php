<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FiscalAuditLog;
use App\Services\Fiscal\FiscalAutomationService;
use App\Services\Fiscal\FiscalAdvancedService;
use App\Services\Fiscal\FiscalComplianceService;
use App\Services\Fiscal\FiscalFinanceService;
use App\Services\Fiscal\FiscalTemplateService;
use App\Services\Fiscal\FiscalWebhookService;
use App\Models\FiscalNote;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Expanded fiscal controller for features #6-30.
 */
class FiscalExpandedController extends Controller
{
    public function __construct(
        private FiscalAutomationService $automation,
        private FiscalAdvancedService $advanced,
        private FiscalComplianceService $compliance,
        private FiscalFinanceService $finance,
        private FiscalTemplateService $templates,
        private FiscalWebhookService $webhooks,
    ) {}

    // ─── Automation (#6-9) ─────────────────────────

    /**
     * #7 — Batch emit fiscal notes.
     */
    public function emitBatch(Request $request): JsonResponse
    {
        $request->validate([
            'source_ids' => 'required|array|min:1|max:50',
            'source_ids.*' => 'integer',
            'source_type' => 'required|in:work_order,quote',
            'note_type' => 'required|in:nfe,nfse',
        ]);

        $result = $this->automation->emitBatch(
            $request->source_ids,
            $request->source_type,
            $request->note_type,
            $request->user()->tenant_id,
            $request->user()->id,
        );

        return response()->json($result);
    }

    /**
     * #8 — Schedule emission for a future date.
     */
    public function scheduleEmission(Request $request): JsonResponse
    {
        $request->validate([
            'type' => 'required|in:nfe,nfse',
            'customer_id' => 'required|integer',
            'scheduled_at' => 'required|date|after:now',
            'work_order_id' => 'nullable|integer',
            'quote_id' => 'nullable|integer',
        ]);

        $scheduled = $this->automation->scheduleEmission(
            $request->all(),
            Carbon::parse($request->scheduled_at),
            $request->user()->tenant_id,
            $request->user()->id,
        );

        return response()->json($scheduled, 201);
    }

    /**
     * #9 — Retry email for a fiscal note.
     */
    public function retryEmail(Request $request, int $id): JsonResponse
    {
        $note = FiscalNote::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $result = $this->automation->retryEmail($note);
        return response()->json($result);
    }

    // ─── Webhooks (#10) ────────────────────────────

    public function listWebhooks(Request $request): JsonResponse
    {
        return response()->json($this->webhooks->listForTenant($request->user()->tenant_id));
    }

    public function createWebhook(Request $request): JsonResponse
    {
        $request->validate([
            'url' => 'required|url',
            'events' => 'nullable|array',
            'events.*' => 'in:authorized,cancelled,rejected,processing,corrected',
        ]);

        $webhook = $this->webhooks->createWebhook($request->user()->tenant_id, $request->all());
        return response()->json($webhook, 201);
    }

    public function deleteWebhook(Request $request, int $id): JsonResponse
    {
        $deleted = $this->webhooks->deleteWebhook($id, $request->user()->tenant_id);
        return $deleted
            ? response()->json(['message' => 'Webhook removido'])
            : response()->json(['error' => 'Webhook não encontrado'], 404);
    }

    // ─── Advanced NF-e (#11-15) ────────────────────

    /**
     * #11 — Issue return (devolução) NF-e.
     */
    public function emitirDevolucao(Request $request, int $id): JsonResponse
    {
        $request->validate(['items' => 'required|array|min:1']);

        $original = FiscalNote::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $result = $this->advanced->emitirDevolucao($original, $request->items, $request->user()->id);

        FiscalAuditLog::log($original, 'devolucao_emitida', $request->user()->id, ['result' => $result['success']]);

        return response()->json($result, $result['success'] ? 201 : 422);
    }

    /**
     * #12 — Issue complementary NF-e.
     */
    public function emitirComplementar(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'valor_complementar' => 'required|numeric|min:0.01',
            'items' => 'nullable|array',
        ]);

        $original = FiscalNote::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $result = $this->advanced->emitirComplementar($original, $request->all(), $request->user()->id);

        FiscalAuditLog::log($original, 'complementar_emitida', $request->user()->id);

        return response()->json($result, $result['success'] ? 201 : 422);
    }

    /**
     * #13 — Issue remittance NF-e.
     */
    public function emitirRemessa(Request $request): JsonResponse
    {
        $request->validate([
            'customer_id' => 'required|integer',
            'items' => 'required|array|min:1',
            'natureza' => 'nullable|string',
            'cfop' => 'nullable|string',
        ]);

        $result = $this->advanced->emitirRemessa($request->all(), $request->user()->tenant, $request->user()->id);
        return response()->json($result, $result['success'] ? 201 : 422);
    }

    /**
     * #13b — Issue return NF-e referencing remittance.
     */
    public function emitirRetorno(Request $request, int $id): JsonResponse
    {
        $request->validate(['items' => 'required|array|min:1']);

        $remessa = FiscalNote::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $result = $this->advanced->emitirRetorno($remessa, $request->items, $request->user()->id);

        return response()->json($result, $result['success'] ? 201 : 422);
    }

    /**
     * #14 — Manifesto do Destinatário.
     */
    public function manifestarDestinatario(Request $request): JsonResponse
    {
        $request->validate([
            'chave_acesso' => 'required|string|size:44',
            'tipo' => 'required|in:ciencia,confirmacao,desconhecimento,nao_realizada',
        ]);

        $result = $this->advanced->manifestarDestinatario(
            $request->chave_acesso, $request->tipo, $request->user()->tenant,
        );

        return response()->json($result);
    }

    /**
     * #15 — Issue CT-e.
     */
    public function emitirCTe(Request $request): JsonResponse
    {
        $request->validate([
            'customer_id' => 'required|integer',
            'valor_total' => 'required|numeric|min:0.01',
        ]);

        $result = $this->advanced->emitirCTe($request->all(), $request->user()->tenant, $request->user()->id);
        return response()->json($result, $result['success'] ? 201 : 422);
    }

    // ─── Compliance (#16-20) ───────────────────────

    /**
     * #16 — Certificate expiry alert.
     */
    public function certificateAlert(Request $request): JsonResponse
    {
        $result = $this->compliance->checkCertificateExpiry($request->user()->tenant);
        return response()->json($result);
    }

    /**
     * #17 — Audit log for a note.
     */
    public function auditLog(Request $request, int $id): JsonResponse
    {
        $logs = $this->compliance->getAuditLog($id, $request->user()->tenant_id);
        return response()->json($logs);
    }

    /**
     * #17b — Audit report.
     */
    public function auditReport(Request $request): JsonResponse
    {
        $result = $this->compliance->auditReport(
            $request->user()->tenant_id,
            $request->query('from'),
            $request->query('to'),
        );
        return response()->json($result);
    }

    /**
     * #18 — Validate CNPJ/CPF.
     */
    public function validateDocument(Request $request): JsonResponse
    {
        $request->validate(['documento' => 'required|string']);
        $result = $this->compliance->validateDocument($request->documento);
        return response()->json($result);
    }

    /**
     * #20 — Check regime compatibility.
     */
    public function checkRegime(Request $request): JsonResponse
    {
        $request->validate(['type' => 'required|string']);
        $result = $this->compliance->blockIncompatibleEmission($request->user()->tenant, $request->type);
        return response()->json($result);
    }

    // ─── Finance (#21-25) ──────────────────────────

    /**
     * #21 — Reconcile with receivables.
     */
    public function reconcile(Request $request, int $id): JsonResponse
    {
        $note = FiscalNote::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $result = $this->finance->reconcileWithReceivables($note);
        FiscalAuditLog::log($note, 'reconciled', $request->user()->id);
        return response()->json($result);
    }

    /**
     * #22 — Generate boleto data.
     */
    public function generateBoleto(Request $request, int $id): JsonResponse
    {
        $note = FiscalNote::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $result = $this->finance->generateBoletoData($note, $request->all());
        return response()->json($result);
    }

    /**
     * #23 — Split payment.
     */
    public function splitPayment(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'payments' => 'required|array|min:1',
            'payments.*.forma_pagamento' => 'required|string',
            'payments.*.valor' => 'required|numeric|min:0.01',
        ]);

        $note = FiscalNote::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $result = $this->finance->applySplitPayment($note, $request->payments);
        return response()->json($result);
    }

    /**
     * #24 — Calculate retentions.
     */
    public function calculateRetentions(Request $request): JsonResponse
    {
        $request->validate(['items' => 'required|array|min:1']);
        $result = $this->finance->calculateRetentions($request->items, $request->user()->tenant);
        return response()->json($result);
    }

    /**
     * #25 — Payment confirmed webhook.
     */
    public function paymentConfirmed(Request $request): JsonResponse
    {
        $request->validate([
            'customer_id' => 'required|integer',
            'amount' => 'required|numeric',
            'transaction_id' => 'required|string',
        ]);

        $result = $this->finance->onPaymentConfirmed(
            $request->user()->tenant_id,
            $request->customer_id,
            $request->amount,
            $request->transaction_id,
        );

        return response()->json($result);
    }

    // ─── Templates & UX (#26-28) ───────────────────

    /**
     * #26 — List templates.
     */
    public function listTemplates(Request $request): JsonResponse
    {
        return response()->json($this->templates->listTemplates($request->user()->tenant_id));
    }

    /**
     * #26 — Save template.
     */
    public function saveTemplate(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:nfe,nfse',
            'template_data' => 'required|array',
        ]);

        $template = $this->templates->saveTemplate(
            $request->name, $request->type, $request->template_data,
            $request->user()->tenant_id, $request->user()->id,
        );

        return response()->json($template, 201);
    }

    /**
     * #26 — Save template from existing note.
     */
    public function saveTemplateFromNote(Request $request, int $id): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:100']);

        $note = FiscalNote::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $template = $this->templates->saveFromNote($note, $request->name);

        return response()->json($template, 201);
    }

    /**
     * #26 — Apply template.
     */
    public function applyTemplate(Request $request, int $id): JsonResponse
    {
        $data = $this->templates->applyTemplate($id, $request->user()->tenant_id);
        return $data
            ? response()->json($data)
            : response()->json(['error' => 'Template não encontrado'], 404);
    }

    /**
     * #26 — Delete template.
     */
    public function deleteTemplate(Request $request, int $id): JsonResponse
    {
        $deleted = $this->templates->deleteTemplate($id, $request->user()->tenant_id);
        return $deleted
            ? response()->json(['message' => 'Template removido'])
            : response()->json(['error' => 'Template não encontrado'], 404);
    }

    /**
     * #27 — Duplicate a fiscal note.
     */
    public function duplicateNote(Request $request, int $id): JsonResponse
    {
        $note = FiscalNote::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $data = $this->templates->duplicateNote($note);
        return response()->json($data);
    }

    /**
     * #28 — Search by access key.
     */
    public function searchByAccessKey(Request $request): JsonResponse
    {
        $request->validate(['chave' => 'required|string']);

        $note = $this->templates->searchByAccessKey($request->chave, $request->user()->tenant_id);
        return $note
            ? response()->json($note)
            : response()->json(['error' => 'Nota não encontrada com esta chave de acesso'], 404);
    }
}
