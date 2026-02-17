<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\{
    AlertConfiguration, CalibrationReading, CertificateTemplate,
    DebtRenegotiation, DocumentVersion, Equipment, EquipmentCalibration,
    ExcentricityTest, PaymentReceipt, QualityAudit, QualityAuditItem,
    StandardWeight, SystemAlert, ToolCalibration, WeightAssignment,
    User,
    WhatsappConfig, WorkOrder, FollowUp, SatisfactionSurvey
};
use App\Services\{
    AlertEngineService, CalibrationCertificateService,
    CollectionAutomationService, DebtRenegotiationService,
    PdfGeneratorService, WhatsAppService
};
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FeaturesController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // CALIBRAÇÃO — Leituras, Excentricidade, Certificado
    // ═══════════════════════════════════════════════════════════════════

    /** Salvar leituras de calibração (preenche dados do certificado). */
    public function storeCalibrationReadings(Request $request, EquipmentCalibration $calibration): JsonResponse
    {
        $data = $request->validate([
            'readings' => 'required|array|min:1',
            'readings.*.reference_value' => 'required|numeric',
            'readings.*.indication_increasing' => 'nullable|numeric',
            'readings.*.indication_decreasing' => 'nullable|numeric',
            'readings.*.k_factor' => 'nullable|numeric',
            'readings.*.repetition' => 'nullable|integer',
            'readings.*.unit' => 'nullable|string|max:10',
        ]);

        DB::transaction(function () use ($calibration, $data, $request) {
            $calibration->readings()->delete(); // substitui todas

            $maxError = 0;
            foreach ($data['readings'] as $i => $reading) {
                $r = CalibrationReading::create([
                    'tenant_id' => $this->tenantId($request),
                    'equipment_calibration_id' => $calibration->id,
                    'reference_value' => $reading['reference_value'],
                    'indication_increasing' => $reading['indication_increasing'] ?? null,
                    'indication_decreasing' => $reading['indication_decreasing'] ?? null,
                    'k_factor' => $reading['k_factor'] ?? 2.00,
                    'repetition' => $reading['repetition'] ?? 1,
                    'unit' => $reading['unit'] ?? 'kg',
                    'reading_order' => $i,
                ]);
                $r->calculateError();
                $r->save();

                if (abs($r->error ?? 0) > $maxError) $maxError = abs($r->error);
            }

            $calibration->update(['max_error_found' => $maxError]);
        });

        return response()->json([
            'message' => 'Leituras salvas com sucesso.',
            'readings' => $calibration->readings()->orderBy('reading_order')->get(),
        ]);
    }

    /** Obter leituras de uma calibração. */
    public function getCalibrationReadings(EquipmentCalibration $calibration): JsonResponse
    {
        return response()->json($calibration->readings()->orderBy('reading_order')->get());
    }

    /** Salvar ensaio de excentricidade. */
    public function storeExcentricityTest(Request $request, EquipmentCalibration $calibration): JsonResponse
    {
        $data = $request->validate([
            'tests' => 'required|array|min:1',
            'tests.*.position' => 'required|string|max:50',
            'tests.*.load_applied' => 'required|numeric',
            'tests.*.indication' => 'required|numeric',
            'tests.*.max_permissible_error' => 'nullable|numeric',
        ]);

        DB::transaction(function () use ($calibration, $data, $request) {
            $calibration->excentricityTests()->delete();

            foreach ($data['tests'] as $i => $test) {
                $t = ExcentricityTest::create([
                    'tenant_id' => $this->tenantId($request),
                    'equipment_calibration_id' => $calibration->id,
                    'position' => $test['position'],
                    'load_applied' => $test['load_applied'],
                    'indication' => $test['indication'],
                    'max_permissible_error' => $test['max_permissible_error'] ?? null,
                    'position_order' => $i,
                ]);
                $t->calculateError();
                $t->save();
            }
        });

        return response()->json([
            'message' => 'Ensaio de excentricidade salvo.',
            'tests' => $calibration->excentricityTests()->orderBy('position_order')->get(),
        ]);
    }

    /** Vincular pesos padrão usados na calibração. */
    public function syncCalibrationWeights(Request $request, EquipmentCalibration $calibration): JsonResponse
    {
        $data = $request->validate(['weight_ids' => 'required|array', 'weight_ids.*' => 'exists:standard_weights,id']);
        $calibration->standardWeights()->sync($data['weight_ids']);

        return response()->json(['message' => 'Pesos vinculados.', 'weights' => $calibration->standardWeights]);
    }

    /** Gerar certificado ISO 17025 (PDF). */
    public function generateCertificate(EquipmentCalibration $calibration, CalibrationCertificateService $service): JsonResponse
    {
        try {
            $path = $service->generateAndStore($calibration);
            return response()->json(['message' => 'Certificado gerado.', 'path' => $path, 'certificate_number' => $calibration->fresh()->certificate_number]);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CERTIFICATE TEMPLATES
    // ═══════════════════════════════════════════════════════════════════

    public function indexCertificateTemplates(Request $request): JsonResponse
    {
        return response()->json(CertificateTemplate::where('tenant_id', $this->tenantId($request))->get());
    }

    public function storeCertificateTemplate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'nullable|string',
            'signatory_name' => 'nullable|string|max:255',
            'signatory_title' => 'nullable|string|max:255',
            'signatory_registration' => 'nullable|string|max:100',
            'is_default' => 'nullable|boolean',
        ]);

        $data['tenant_id'] = $this->tenantId($request);

        if ($request->boolean('is_default')) {
            CertificateTemplate::where('tenant_id', $data['tenant_id'])->update(['is_default' => false]);
        }

        $template = CertificateTemplate::create($data);
        return response()->json($template, 201);
    }

    public function updateCertificateTemplate(Request $request, CertificateTemplate $template): JsonResponse
    {
        $template->update($request->only([
            'name', 'type', 'header_html', 'footer_html', 'signatory_name',
            'signatory_title', 'signatory_registration', 'is_default',
        ]));

        if ($request->boolean('is_default')) {
            CertificateTemplate::where('tenant_id', $template->tenant_id)->where('id', '!=', $template->id)->update(['is_default' => false]);
        }

        return response()->json($template);
    }

    // ═══════════════════════════════════════════════════════════════════
    // WHATSAPP CONFIG
    // ═══════════════════════════════════════════════════════════════════

    public function getWhatsappConfig(Request $request): JsonResponse
    {
        $config = WhatsappConfig::where('tenant_id', $this->tenantId($request))->first();
        return response()->json($config);
    }

    public function saveWhatsappConfig(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider' => 'required|in:evolution,z-api,meta',
            'api_url' => 'required|url',
            'api_key' => 'required|string',
            'instance_name' => 'nullable|string',
            'phone_number' => 'nullable|string',
        ]);

        $data['tenant_id'] = $this->tenantId($request);
        $config = WhatsappConfig::updateOrCreate(['tenant_id' => $data['tenant_id']], $data);

        return response()->json($config);
    }

    public function testWhatsapp(Request $request, WhatsAppService $service): JsonResponse
    {
        $phone = $request->validate(['phone' => 'required|string'])['phone'];
        $log = $service->sendText($this->tenantId($request), $phone, '✅ Teste de conexão WhatsApp — Kalibrium');

        return response()->json(['success' => $log?->status === 'sent', 'log' => $log]);
    }

    public function sendWhatsapp(Request $request, WhatsAppService $service): JsonResponse
    {
        $data = $request->validate([
            'phone' => 'required|string',
            'message' => 'required|string|max:4096',
        ]);

        $log = $service->sendText($this->tenantId($request), $data['phone'], $data['message']);
        return response()->json($log);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ALERTAS
    // ═══════════════════════════════════════════════════════════════════

    public function indexAlerts(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);
        $q = SystemAlert::where('tenant_id', $tid);

        if ($status = $request->input('status')) $q->where('status', $status);
        if ($type = $request->input('type')) $q->where('alert_type', $type);
        if ($severity = $request->input('severity')) $q->where('severity', $severity);

        $groupBy = $request->input('group_by');
        if ($groupBy === 'alert_type') {
            $items = (clone $q)->select('alert_type', DB::raw('count(*) as count'), DB::raw('max(created_at) as latest_at'))
                ->groupBy('alert_type')
                ->orderByDesc('count')
                ->get();
            return response()->json(['data' => $items, 'grouped' => true]);
        }
        if ($groupBy === 'entity') {
            $items = (clone $q)->select('alertable_type', 'alertable_id', 'alert_type', DB::raw('count(*) as count'), DB::raw('max(created_at) as latest_at'))
                ->whereNotNull('alertable_type')
                ->groupBy('alertable_type', 'alertable_id', 'alert_type')
                ->orderByDesc('count')
                ->get();
            return response()->json(['data' => $items, 'grouped' => true]);
        }

        return response()->json($q->orderByDesc('created_at')->paginate($request->input('per_page', 25)));
    }

    public function exportAlerts(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $tid = $this->tenantId($request);
        $q = SystemAlert::where('tenant_id', $tid);

        if ($status = $request->input('status')) $q->where('status', $status);
        if ($type = $request->input('type')) $q->where('alert_type', $type);
        if ($severity = $request->input('severity')) $q->where('severity', $severity);
        $from = $request->input('from');
        $to = $request->input('to');
        if ($from) $q->whereDate('created_at', '>=', $from);
        if ($to) $q->whereDate('created_at', '<=', $to);

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="alertas-' . date('Y-m-d-His') . '.csv"',
        ];

        return response()->stream(function () use ($q) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['ID', 'Tipo', 'Severidade', 'Título', 'Mensagem', 'Status', 'Criado em', 'Reconhecido em', 'Resolvido em'], ';');
            $q->orderByDesc('created_at')->chunk(100, function ($alerts) use ($out) {
                foreach ($alerts as $a) {
                    fputcsv($out, [
                        $a->id,
                        $a->alert_type,
                        $a->severity,
                        $a->title,
                        $a->message,
                        $a->status,
                        $a->created_at?->format('d/m/Y H:i'),
                        $a->acknowledged_at?->format('d/m/Y H:i'),
                        $a->resolved_at?->format('d/m/Y H:i'),
                    ], ';');
                }
            });
            fclose($out);
        }, 200, $headers);
    }

    public function acknowledgeAlert(Request $request, SystemAlert $alert): JsonResponse
    {
        $alert->update(['status' => 'acknowledged', 'acknowledged_by' => $request->user()->id, 'acknowledged_at' => now()]);
        return response()->json($alert);
    }

    public function resolveAlert(SystemAlert $alert): JsonResponse
    {
        $alert->update(['status' => 'resolved', 'resolved_at' => now()]);
        return response()->json($alert);
    }

    public function dismissAlert(SystemAlert $alert): JsonResponse
    {
        $alert->update(['status' => 'dismissed']);
        return response()->json(['message' => 'Alerta descartado.']);
    }

    public function alertSummary(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);
        $active = SystemAlert::withoutGlobalScope('tenant')->where('tenant_id', $tid)->active();

        return response()->json([
            'total_active' => (clone $active)->count(),
            'critical' => (clone $active)->where('severity', 'critical')->count(),
            'high' => (clone $active)->where('severity', 'high')->count(),
            'by_type' => (clone $active)->select('alert_type', DB::raw('count(*) as total'))->groupBy('alert_type')->pluck('total', 'alert_type'),
        ]);
    }

    public function runAlertEngine(Request $request, AlertEngineService $engine): JsonResponse
    {
        $results = $engine->runAllChecks($this->tenantId($request));
        return response()->json(['message' => 'Verificação concluída.', 'results' => $results]);
    }

    public function indexAlertConfigs(Request $request): JsonResponse
    {
        return response()->json(AlertConfiguration::where('tenant_id', $this->tenantId($request))->get());
    }

    public function updateAlertConfig(Request $request, string $alertType): JsonResponse
    {
        $data = $request->validate([
            'is_enabled' => 'nullable|boolean',
            'channels' => 'nullable|array',
            'days_before' => 'nullable|integer',
            'recipients' => 'nullable|array',
            'escalation_hours' => 'nullable|integer|min:0',
            'escalation_recipients' => 'nullable|array',
            'escalation_recipients.*' => 'integer',
            'blackout_start' => 'nullable|string|max:5',
            'blackout_end' => 'nullable|string|max:5',
            'threshold_amount' => 'nullable|numeric|min:0',
        ]);

        $config = AlertConfiguration::updateOrCreate(
            ['tenant_id' => $this->tenantId($request), 'alert_type' => $alertType],
            $data
        );

        return response()->json($config);
    }

    // ═══════════════════════════════════════════════════════════════════
    // FINANCEIRO — Renegociação + Recibos + Régua de Cobrança
    // ═══════════════════════════════════════════════════════════════════

    public function indexRenegotiations(Request $request): JsonResponse
    {
        return response()->json(
            DebtRenegotiation::where('tenant_id', $this->tenantId($request))
                ->with(['customer:id,name', 'creator:id,name'])
                ->orderByDesc('created_at')
                ->paginate($request->input('per_page', 25))
        );
    }

    public function storeRenegotiation(Request $request, DebtRenegotiationService $service): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'receivable_ids' => 'required|array|min:1',
            'receivable_ids.*' => 'exists:accounts_receivable,id',
            'negotiated_total' => 'required|numeric|min:0.01',
            'discount_amount' => 'nullable|numeric|min:0',
            'interest_amount' => 'nullable|numeric|min:0',
            'fine_amount' => 'nullable|numeric|min:0',
            'new_installments' => 'required|integer|min:1|max:60',
            'first_due_date' => 'required|date|after:today',
            'notes' => 'nullable|string',
        ]);

        $data['tenant_id'] = $this->tenantId($request);
        $renegotiation = $service->create($data, $data['receivable_ids'], $request->user()->id);

        return response()->json($renegotiation, 201);
    }

    public function approveRenegotiation(Request $request, DebtRenegotiation $renegotiation, DebtRenegotiationService $service): JsonResponse
    {
        if ($renegotiation->status !== 'pending') {
            return response()->json(['message' => 'Renegociação não está pendente.'], 422);
        }

        $result = $service->approve($renegotiation, $request->user()->id);
        return response()->json(['message' => 'Renegociação aprovada. Novas parcelas geradas.', 'renegotiation' => $result]);
    }

    public function rejectRenegotiation(DebtRenegotiation $renegotiation, DebtRenegotiationService $service): JsonResponse
    {
        $result = $service->reject($renegotiation);
        return response()->json(['message' => 'Renegociação rejeitada.', 'renegotiation' => $result]);
    }

    public function generateReceipt(Request $request, int $paymentId): JsonResponse
    {
        $payment = \App\Models\Payment::findOrFail($paymentId);
        $receipt = PaymentReceipt::create([
            'tenant_id' => $this->tenantId($request),
            'payment_id' => $payment->id,
            'receipt_number' => 'REC-' . str_pad((string) (PaymentReceipt::where('tenant_id', $this->tenantId($request))->count() + 1), 6, '0', STR_PAD_LEFT),
            'generated_by' => $request->user()->id,
        ]);

        return response()->json($receipt, 201);
    }

    public function runCollectionEngine(Request $request, CollectionAutomationService $service): JsonResponse
    {
        $results = $service->processForTenant($this->tenantId($request));
        return response()->json(['message' => 'Régua de cobrança executada.', 'results' => $results]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // LOGÍSTICA — Checkin/Checkout + QR Equipment
    // ═══════════════════════════════════════════════════════════════════

    public function checkinWorkOrder(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $data = $request->validate(['lat' => 'required|numeric', 'lng' => 'required|numeric']);

        $workOrder->update([
            'checkin_at' => now(),
            'checkin_lat' => $data['lat'],
            'checkin_lng' => $data['lng'],
        ]);

        return response()->json(['message' => 'Check-in registrado.', 'checkin_at' => $workOrder->checkin_at]);
    }

    public function checkoutWorkOrder(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $data = $request->validate(['lat' => 'required|numeric', 'lng' => 'required|numeric']);

        $autoKm = null;
        if ($workOrder->checkin_lat && $workOrder->checkin_lng) {
            $autoKm = $this->haversineDistance($workOrder->checkin_lat, $workOrder->checkin_lng, $data['lat'], $data['lng']);
        }

        $workOrder->update([
            'checkout_at' => now(),
            'checkout_lat' => $data['lat'],
            'checkout_lng' => $data['lng'],
            'auto_km_calculated' => $autoKm,
        ]);

        return response()->json(['message' => 'Check-out registrado.', 'auto_km' => $autoKm]);
    }

    public function equipmentByQr(string $token): JsonResponse
    {
        $equipment = Equipment::where('qr_token', $token)
            ->with(['customer:id,name', 'calibrations' => fn($q) => $q->latest()->limit(1)])
            ->firstOrFail();

        $lastCal = $equipment->calibrations->first();
        $tenant = \App\Models\Tenant::find($equipment->tenant_id);

        return response()->json([
            'equipment' => [
                'code' => $equipment->code,
                'brand' => $equipment->brand,
                'model' => $equipment->model,
                'serial_number' => $equipment->serial_number,
                'capacity' => $equipment->capacity,
                'capacity_unit' => $equipment->capacity_unit,
                'resolution' => $equipment->resolution,
                'precision_class' => $equipment->precision_class,
                'location' => $equipment->location,
            ],
            'customer' => $equipment->customer ? ['name' => $equipment->customer->name] : null,
            'tenant' => $tenant ? ['name' => $tenant->name] : null,
            'last_calibration' => $lastCal ? [
                'certificate_number' => $lastCal->certificate_number,
                'calibration_date' => $lastCal->calibration_date?->toDateString(),
                'next_due_date' => $lastCal->next_due_date?->toDateString(),
                'result' => $lastCal->result,
                'laboratory' => $lastCal->laboratory,
            ] : null,
        ]);
    }

    public function generateEquipmentQr(Equipment $equipment): JsonResponse
    {
        if (!$equipment->qr_token) {
            $equipment->update(['qr_token' => Str::random(48)]);
        }

        $publicUrl = config('app.url') . "/api/v1/equipment-qr/{$equipment->qr_token}";
        return response()->json(['qr_token' => $equipment->qr_token, 'public_url' => $publicUrl]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // QUALIDADE ISO — Auditorias + Documentos + CAPA
    // ═══════════════════════════════════════════════════════════════════

    public function indexAudits(Request $request): JsonResponse
    {
        return response()->json(
            QualityAudit::where('tenant_id', $this->tenantId($request))
                ->with('auditor:id,name')
                ->orderByDesc('planned_date')
                ->paginate($request->input('per_page', 25))
        );
    }

    public function showAudit(Request $request, QualityAudit $audit): JsonResponse
    {
        if ($audit->tenant_id !== $this->tenantId($request)) {
            abort(404);
        }
        $audit->load(['auditor:id,name', 'items' => fn ($q) => $q->orderBy('item_order')]);
        return response()->json(['data' => $audit]);
    }

    public function updateAudit(Request $request, QualityAudit $audit): JsonResponse
    {
        if ($audit->tenant_id !== $this->tenantId($request)) {
            abort(404);
        }
        $data = $request->validate([
            'status' => 'nullable|in:planned,in_progress,completed,cancelled',
            'executed_date' => 'nullable|date',
            'summary' => 'nullable|string',
        ]);
        if (isset($data['status']) && $data['status'] === 'completed' && !$audit->executed_date && empty($data['executed_date'])) {
            $data['executed_date'] = now()->toDateString();
        }
        $audit->update($data);
        return response()->json($audit->fresh(['auditor:id,name', 'items']));
    }

    public function storeAudit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'nullable|in:internal,external,supplier',
            'scope' => 'nullable|string',
            'planned_date' => 'required|date',
            'auditor_id' => 'required|exists:users,id',
            'items' => 'nullable|array',
            'items.*.requirement' => 'required_with:items|string',
            'items.*.clause' => 'nullable|string',
            'items.*.question' => 'required_with:items|string',
        ]);

        $data['tenant_id'] = $this->tenantId($request);
        $data['audit_number'] = 'AUD-' . str_pad((string) (QualityAudit::where('tenant_id', $data['tenant_id'])->count() + 1), 4, '0', STR_PAD_LEFT);

        $audit = DB::transaction(function () use ($data) {
            $audit = QualityAudit::create($data);

            foreach ($data['items'] ?? [] as $i => $item) {
                QualityAuditItem::create([
                    'quality_audit_id' => $audit->id,
                    'requirement' => $item['requirement'],
                    'clause' => $item['clause'] ?? null,
                    'question' => $item['question'],
                    'item_order' => $i,
                ]);
            }

            return $audit;
        });

        return response()->json($audit->load('items'), 201);
    }

    public function updateAuditItem(Request $request, QualityAuditItem $item): JsonResponse
    {
        $item->update($request->only(['result', 'evidence', 'notes']));

        // Recomputa totais da auditoria
        $audit = $item->audit;
        $audit->update([
            'non_conformities_found' => $audit->items()->where('result', 'non_conform')->count(),
            'observations_found' => $audit->items()->where('result', 'observation')->count(),
        ]);

        return response()->json($item);
    }

    public function indexDocuments(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);
        $q = DocumentVersion::where('tenant_id', $tid);
        if ($cat = $request->input('category')) $q->where('category', $cat);
        if ($status = $request->input('status')) $q->where('status', $status);
        if ($request->boolean('current_only')) {
            $codes = DocumentVersion::where('tenant_id', $tid)->where('status', 'approved')
                ->selectRaw('document_code, MAX(id) as latest_id')->groupBy('document_code')->pluck('latest_id');
            $q->whereIn('id', $codes);
        }

        return response()->json($q->with('creator:id,name')->orderByDesc('updated_at')->paginate($request->input('per_page', 25)));
    }

    public function storeDocument(Request $request): JsonResponse
    {
        $data = $request->validate([
            'document_code' => 'required|string|max:50',
            'title' => 'required|string|max:255',
            'category' => 'required|in:procedure,instruction,form,record,policy,manual',
            'version' => 'required|string|max:20',
            'description' => 'nullable|string',
            'effective_date' => 'nullable|date',
            'review_date' => 'nullable|date',
        ]);

        $data['tenant_id'] = $this->tenantId($request);
        $data['created_by'] = $request->user()->id;
        $data['status'] = 'draft';

        return response()->json(DocumentVersion::create($data), 201);
    }

    public function approveDocument(Request $request, DocumentVersion $document): JsonResponse
    {
        $document->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        // Torna versões anteriores do mesmo código obsoletas
        DocumentVersion::where('tenant_id', $document->tenant_id)
            ->where('document_code', $document->document_code)
            ->where('id', '!=', $document->id)
            ->where('status', 'approved')
            ->update(['status' => 'obsolete']);

        return response()->json($document);
    }

    public function uploadDocumentFile(Request $request, DocumentVersion $document): JsonResponse
    {
        if ($document->tenant_id !== $this->tenantId($request)) {
            abort(404);
        }
        $request->validate(['file' => 'required|file|max:51200']); // 50MB
        $file = $request->file('file');
        $dir = "quality_documents/{$document->tenant_id}/{$document->id}";
        $path = $file->storeAs($dir, $file->getClientOriginalName(), 'public');
        $document->update(['file_path' => $path]);
        return response()->json(['message' => 'Arquivo anexado', 'file_path' => $path, 'data' => $document->fresh()]);
    }

    public function downloadDocument(Request $request, DocumentVersion $document): StreamedResponse
    {
        if ($document->tenant_id !== $this->tenantId($request) || !$document->file_path) {
            abort(404);
        }
        if (!Storage::disk('public')->exists($document->file_path)) {
            abort(404);
        }
        $name = basename($document->file_path);
        return Storage::disk('public')->download($document->file_path, $name);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PESOS PADRÃO — Atribuição a veículos/técnicos
    // ═══════════════════════════════════════════════════════════════════

    public function indexWeightAssignments(Request $request): JsonResponse
    {
        return response()->json(
            WeightAssignment::where('tenant_id', $this->tenantId($request))
                ->with(['weight:id,code,nominal_value,unit', 'user:id,name', 'vehicle:id,plate,model'])
                ->orderByDesc('assigned_at')
                ->paginate($request->input('per_page', 25))
        );
    }

    public function assignWeight(Request $request): JsonResponse
    {
        $data = $request->validate([
            'standard_weight_id' => 'required|exists:standard_weights,id',
            'assigned_to_user_id' => 'nullable|exists:users,id',
            'assigned_to_vehicle_id' => 'nullable|exists:fleet_vehicles,id',
            'assignment_type' => 'nullable|in:field,storage,calibration_lab',
            'notes' => 'nullable|string',
        ]);

        // Encerra atribuição anterior ativa
        WeightAssignment::where('standard_weight_id', $data['standard_weight_id'])
            ->whereNull('returned_at')
            ->update(['returned_at' => now()]);

        $assignment = WeightAssignment::create([
            'tenant_id' => $this->tenantId($request),
            'standard_weight_id' => $data['standard_weight_id'],
            'assigned_to_user_id' => $data['assigned_to_user_id'] ?? null,
            'assigned_to_vehicle_id' => $data['assigned_to_vehicle_id'] ?? null,
            'assignment_type' => $data['assignment_type'] ?? 'field',
            'assigned_at' => now(),
            'assigned_by' => $request->user()->id,
            'notes' => $data['notes'] ?? null,
        ]);

        // Atualiza o peso
        StandardWeight::find($data['standard_weight_id'])?->update([
            'assigned_to_user_id' => $data['assigned_to_user_id'],
            'assigned_to_vehicle_id' => $data['assigned_to_vehicle_id'],
        ]);

        return response()->json($assignment->load(['weight', 'user', 'vehicle']), 201);
    }

    public function returnWeight(WeightAssignment $assignment): JsonResponse
    {
        $assignment->update(['returned_at' => now()]);
        $assignment->weight?->update(['assigned_to_user_id' => null, 'assigned_to_vehicle_id' => null]);

        return response()->json(['message' => 'Peso devolvido.']);
    }

    // ═══════════════════════════════════════════════════════════════════
    // FERRAMENTAS — Calibração
    // ═══════════════════════════════════════════════════════════════════

    public function indexToolCalibrations(Request $request): JsonResponse
    {
        return response()->json(
            ToolCalibration::where('tenant_id', $this->tenantId($request))
                ->with('tool:id,name,serial_number')
                ->orderByDesc('calibration_date')
                ->paginate($request->input('per_page', 25))
        );
    }

    public function storeToolCalibration(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tool_inventory_id' => 'required|exists:tool_inventories,id',
            'calibration_date' => 'required|date',
            'next_due_date' => 'required|date|after:calibration_date',
            'certificate_number' => 'nullable|string',
            'laboratory' => 'nullable|string',
            'result' => 'nullable|in:approved,rejected,adjusted',
            'cost' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $data['tenant_id'] = $this->tenantId($request);

        return response()->json(ToolCalibration::create($data), 201);
    }

    public function updateToolCalibration(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'tool_inventory_id' => 'nullable|exists:tool_inventories,id',
            'calibration_date' => 'nullable|date',
            'next_due_date' => 'nullable|date|after:calibration_date',
            'certificate_number' => 'nullable|string',
            'laboratory' => 'nullable|string',
            'result' => 'nullable|in:approved,rejected,adjusted',
            'cost' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $calibration = ToolCalibration::findOrFail($id);
        $calibration->update(array_filter($data, fn ($v) => $v !== null));

        return response()->json($calibration);
    }

    public function destroyToolCalibration(int $id): JsonResponse
    {
        ToolCalibration::findOrFail($id)->delete();

        return response()->json(null, 204);
    }

    public function expiringToolCalibrations(Request $request): JsonResponse
    {
        $days = (int) $request->input('days', 30);

        return response()->json(
            ToolCalibration::where('tenant_id', $this->tenantId($request))
                ->expiring($days)
                ->with('tool:id,name,serial_number')
                ->orderBy('next_due_date')
                ->get()
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // DASHBOARD NPS
    // ═══════════════════════════════════════════════════════════════════

    public function dashboardNps(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);

        $surveys = SatisfactionSurvey::where('tenant_id', $tid)
            ->whereNotNull('nps_score')
            ->where('created_at', '>=', now()->subMonths(3))
            ->get();

        if ($surveys->isEmpty()) {
            return response()->json(['data' => null]);
        }

        $total = $surveys->count();
        $promoters = $surveys->where('nps_score', '>=', 9)->count();
        $detractors = $surveys->where('nps_score', '<=', 6)->count();
        $npsScore = round(($promoters - $detractors) / $total * 100);

        $avgRating = $surveys->avg('service_rating');
        $totalResponses = $total;

        return response()->json(['data' => [
            'nps_score' => $npsScore,
            'promoters' => round($promoters / $total * 100),
            'detractors' => round($detractors / $total * 100),
            'avg_rating' => $avgRating,
            'total_responses' => $totalResponses,
        ]]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // WHATSAPP LOGS
    // ═══════════════════════════════════════════════════════════════════

    public function whatsappLogs(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);
        $query = \App\Models\WhatsappMessageLog::where('tenant_id', $tid)->orderByDesc('created_at');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('phone', 'like', "%{$search}%")
                  ->orWhere('content', 'like', "%{$search}%");
            });
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        return response()->json(['data' => $query->limit(200)->get()]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // COLLECTION AUTOMATION
    // ═══════════════════════════════════════════════════════════════════

    public function collectionSummary(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);

        $overdue = \App\Models\AccountReceivable::where('tenant_id', $tid)
            ->where('status', 'overdue')
            ->selectRaw('COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount')
            ->first();

        $actionsToday = DB::table('collection_actions')
            ->where('tenant_id', $tid)
            ->whereDate('executed_at', today())
            ->count();

        $actionsPending = DB::table('collection_actions')
            ->where('tenant_id', $tid)
            ->where('status', 'pending')
            ->count();

        return response()->json(['data' => [
            'total_overdue' => (int) ($overdue->total ?? 0),
            'total_overdue_amount' => (float) ($overdue->total_amount ?? 0),
            'actions_today' => $actionsToday,
            'actions_pending' => $actionsPending,
        ]]);
    }

    public function collectionActions(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);

        $actions = DB::table('collection_actions')
            ->where('collection_actions.tenant_id', $tid)
            ->leftJoin('accounts_receivable', 'collection_actions.account_receivable_id', '=', 'accounts_receivable.id')
            ->leftJoin('customers', 'accounts_receivable.customer_id', '=', 'customers.id')
            ->select([
                'collection_actions.*',
                'customers.name as customer_name',
                'accounts_receivable.description as receivable_description',
                'accounts_receivable.amount',
            ])
            ->orderByDesc('collection_actions.created_at')
            ->limit(200)
            ->get();

        return response()->json(['data' => $actions]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════

    private function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return round($r * 2 * atan2(sqrt($a), sqrt(1 - $a)), 2);
    }
}
