<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Equipment\StoreEquipmentRequest;
use App\Http\Requests\Equipment\UpdateEquipmentRequest;
use App\Models\Equipment;
use App\Models\EquipmentCalibration;
use App\Models\EquipmentMaintenance;
use App\Models\EquipmentDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class EquipmentController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    /**
     * Listagem com filtros avançados.
     */
    public function index(Request $request): JsonResponse
    {
        $q = Equipment::where('tenant_id', $this->tenantId($request))
            ->with(['customer:id,name', 'responsible:id,name']);

        // Filtros
        if ($s = $request->input('search')) {
            $q->where(function ($q2) use ($s) {
                $q2->where('code', 'like', "%{$s}%")
                    ->orWhere('serial_number', 'like', "%{$s}%")
                    ->orWhere('brand', 'like', "%{$s}%")
                    ->orWhere('model', 'like', "%{$s}%")
                    ->orWhere('tag', 'like', "%{$s}%");
            });
        }

        if ($cat = $request->input('category')) $q->where('category', $cat);
        if ($status = $request->input('status')) $q->where('status', $status);
        if ($customerId = $request->input('customer_id')) $q->where('customer_id', $customerId);
        if ($request->boolean('critical')) $q->critical();
        if ($request->boolean('overdue')) $q->overdue();

        if ($cal = $request->input('calibration_due')) {
            $q->calibrationDue((int) $cal);
        }

        $equipments = $q->orderByDesc('updated_at')->paginate($request->input('per_page', 25));

        return response()->json($equipments);
    }

    /**
     * Detalhes do equipamento com relações.
     */
    public function show(Request $request, Equipment $equipment): JsonResponse
    {
        $this->checkTenantAccess($request, $equipment);

        $equipment->load([
            'customer:id,name,document,phone',
            'responsible:id,name',
            'equipmentModel:id,name,brand,category',
            'equipmentModel.products:id,name,code',
            'calibrations' => fn($q) => $q->limit(10),
            'calibrations.performer:id,name',
            'maintenances' => fn($q) => $q->limit(10),
            'maintenances.performer:id,name',
            'documents',
        ]);

        $equipment->append('calibration_status');

        return response()->json(['equipment' => $equipment]);
    }

    /**
     * Criar equipamento.
     */
    public function store(StoreEquipmentRequest $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $data = $request->validated();

        // Calcular vencimento automaticamente se não informado e tiver base
        if (empty($data['next_calibration_at']) && !empty($data['last_calibration_at']) && !empty($data['calibration_interval_months'])) {
            $data['next_calibration_at'] = \Carbon\Carbon::parse($data['last_calibration_at'])
                ->addMonths((int)$data['calibration_interval_months'])
                ->toDateString();
        }

        $data['tenant_id'] = $tenantId;
        $data['code'] = Equipment::generateCode($tenantId);

        try {
            $equipment = DB::transaction(fn () => Equipment::create($data));
            return response()->json(['equipment' => $equipment->load('customer:id,name')], 201);
        } catch (\Throwable $e) {
            Log::error('Equipment store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar equipamento'], 500);
        }
    }

    /**
     * Atualizar equipamento.
     */
    public function update(UpdateEquipmentRequest $request, Equipment $equipment): JsonResponse
    {
        $this->checkTenantAccess($request, $equipment);

        $tenantId = $this->tenantId($request);

        $data = $request->validated();

        // Calcular vencimento automaticamente se parâmetros mudaram
        if (
            (isset($data['last_calibration_at']) || isset($data['calibration_interval_months'])) &&
            empty($data['next_calibration_at'])
        ) {
            $last = $data['last_calibration_at'] ?? $equipment->last_calibration_at;
            $interval = $data['calibration_interval_months'] ?? $equipment->calibration_interval_months;

            if ($last && $interval) {
                $data['next_calibration_at'] = \Carbon\Carbon::parse($last)
                    ->addMonths((int)$interval)
                    ->toDateString();
            }
        }

        try {
            DB::transaction(fn () => $equipment->update($data));
            return response()->json(['equipment' => $equipment->fresh('customer:id,name')]);
        } catch (\Throwable $e) {
            Log::error('Equipment update failed', ['id' => $equipment->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar equipamento'], 500);
        }
    }

    /**
     * Excluir (soft delete).
     */
    public function destroy(Request $request, Equipment $equipment): JsonResponse
    {
        $this->checkTenantAccess($request, $equipment);

        try {
            DB::transaction(fn () => $equipment->delete());
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('Equipment destroy failed', ['id' => $equipment->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir equipamento'], 500);
        }
    }

    /**
     * Dashboard KPIs dos equipamentos.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);

        $total = Equipment::where('tenant_id', $tid)->active()->count();
        $overdue = Equipment::where('tenant_id', $tid)->overdue()->count();
        $due7 = Equipment::where('tenant_id', $tid)->calibrationDue(7)->count() - $overdue;
        $due30 = Equipment::where('tenant_id', $tid)->calibrationDue(30)->count() - $overdue - $due7;
        $critical = Equipment::where('tenant_id', $tid)->critical()->active()->count();

        $byCategory = Equipment::where('tenant_id', $tid)
            ->active()
            ->selectRaw('category, count(*) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $byStatus = Equipment::where('tenant_id', $tid)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $recentCalibrations = EquipmentCalibration::whereHas('equipment', fn($q) => $q->where('tenant_id', $tid))
            ->with('equipment:id,code,brand,model')
            ->orderByDesc('calibration_date')
            ->limit(5)
            ->get();

        return response()->json([
            'total' => $total,
            'overdue' => $overdue,
            'due_7_days' => max(0, $due7),
            'due_30_days' => max(0, $due30),
            'critical_count' => $critical,
            'by_category' => $byCategory,
            'by_status' => $byStatus,
            'recent_calibrations' => $recentCalibrations,
        ]);
    }

    /**
     * Alertas de calibração vencendo.
     */
    public function alerts(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);

        $equipments = Equipment::where('tenant_id', $tid)
            ->calibrationDue(60)
            ->active()
            ->with('customer:id,name')
            ->orderBy('next_calibration_at')
            ->get()
            ->map(fn($e) => [
                'id' => $e->id,
                'code' => $e->code,
                'brand' => $e->brand,
                'model' => $e->model,
                'serial_number' => $e->serial_number,
                'customer' => $e->customer?->name,
                'next_calibration_at' => $e->next_calibration_at?->toDateString(),
                'days_remaining' => $e->next_calibration_at?->diffInDays(now(), false),
                'status' => $e->calibration_status,
            ]);

        return response()->json(['alerts' => $equipments]);
    }

    // ─── Calibrações ────────────────────────────────────────

    public function history(Request $request, Equipment $equipment): JsonResponse
    {
        $this->checkTenantAccess($request, $equipment);

        $calibrations = $equipment->calibrations()
            ->with(['performer:id,name', 'workOrder:id,number,os_number,status'])
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'type' => 'calibration',
                'date' => $c->calibration_date,
                'title' => "Calibração: {$c->certificate_number}",
                'result' => $c->result,
                'performer' => $c->performer?->name,
                'work_order' => $c->workOrder,
                'details' => $c,
            ]);

        $maintenances = $equipment->maintenances()
            ->with(['performer:id,name', 'workOrder:id,number,os_number,status'])
            ->get()
            ->map(fn($m) => [
                'id' => $m->id,
                'type' => 'maintenance',
                'date' => $m->created_at,
                'title' => "Manutenção: " . (ucfirst($m->type)),
                'result' => null,
                'performer' => $m->performer?->name,
                'work_order' => $m->workOrder,
                'details' => $m,
            ]);

        $all = $calibrations->concat($maintenances)->sortByDesc('date')->values();

        return response()->json(['history' => $all]);
    }

    public function calibrationHistory(Equipment $equipment): JsonResponse
    {
        $calibrations = $equipment->calibrations()
            ->with(['performer:id,name', 'approver:id,name', 'standardWeights:id,code,nominal_value,unit,certificate_number'])
            ->get();

        return response()->json(['calibrations' => $calibrations]);
    }

    public function addCalibration(Request $request, Equipment $equipment): JsonResponse
    {
        $this->checkTenantAccess($request, $equipment);

        $data = $request->validate([
            'calibration_date' => 'required|date',
            'calibration_type' => 'required|in:interna,externa,rastreada_rbc',
            'result' => 'required|in:aprovado,aprovado_com_ressalva,reprovado',
            'laboratory' => 'nullable|string|max:150',
            'certificate_number' => 'nullable|string|max:50',
            'certificate_pdf_path' => 'nullable|string|max:255',
            'standard_used' => 'nullable|string|max:255',
            'standard_weight_ids' => 'nullable|array',
            'standard_weight_ids.*' => 'exists:standard_weights,id',
            'uncertainty' => 'nullable|numeric',
            'error_found' => 'nullable|numeric',
            'errors_found' => 'nullable|array',
            'technician_notes' => 'nullable|string',
            'temperature' => 'nullable|numeric',
            'humidity' => 'nullable|numeric',
            'pressure' => 'nullable|numeric',
            'corrections_applied' => 'nullable|string',
            'cost' => 'nullable|numeric',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'notes' => 'nullable|string',
        ]);

        $standardWeightIds = $data['standard_weight_ids'] ?? [];
        unset($data['standard_weight_ids']);

        $data['performed_by'] = $request->user()->id;

        try {
            \Illuminate\Support\Facades\DB::beginTransaction();

            // Calcular próximo vencimento
            if ($equipment->calibration_interval_months) {
                $data['next_due_date'] = \Carbon\Carbon::parse($data['calibration_date'])
                    ->addMonths($equipment->calibration_interval_months);
            } else {
                $data['next_due_date'] = \Carbon\Carbon::parse($data['calibration_date'])->addMonths(12);
            }

            $calibration = $equipment->calibrations()->create($data);

            // Attach standard weights (pesos padrão)
            if (!empty($standardWeightIds)) {
                $calibration->standardWeights()->attach($standardWeightIds);
            }

            // Atualizar equipamento
            $equipment->update([
                'last_calibration_at' => $data['calibration_date'],
                'next_calibration_at' => $data['next_due_date'] ?? null,
                'certificate_number' => $data['certificate_number'] ?? $equipment->certificate_number,
                'status' => Equipment::STATUS_ACTIVE,
            ]);

            \Illuminate\Support\Facades\DB::commit();

            return response()->json(['calibration' => $calibration->load('standardWeights')], 201);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            report($e);
            return response()->json(['message' => 'Erro ao registrar calibração: ' . $e->getMessage()], 500);
        }
    }

    // ─── Manutenções ────────────────────────────────────────

    public function addMaintenance(Request $request, Equipment $equipment): JsonResponse
    {
        $this->checkTenantAccess($request, $equipment);

        $data = $request->validate([
            'type' => 'required|in:preventiva,corretiva,ajuste,limpeza',
            'description' => 'required|string',
            'parts_replaced' => 'nullable|string',
            'cost' => 'nullable|numeric',
            'downtime_hours' => 'nullable|numeric',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'next_maintenance_at' => 'nullable|date',
        ]);

        $data['performed_by'] = $request->user()->id;

        try {
            $maintenance = $equipment->maintenances()->create($data);
            return response()->json(['maintenance' => $maintenance], 201);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao registrar manutenção: ' . $e->getMessage()], 500);
        }
    }

    // ─── Documentos ─────────────────────────────────────────

    public function uploadDocument(Request $request, Equipment $equipment): JsonResponse
    {
        $this->checkTenantAccess($request, $equipment);

        $request->validate([
            'file' => 'required|file|max:10240',
            'type' => 'required|in:certificado,manual,foto,laudo,relatorio',
            'name' => 'required|string|max:150',
            'expires_at' => 'nullable|date',
        ]);

        $path = $request->file('file')->store("equipment_docs/{$equipment->id}", 'local');

        $doc = $equipment->documents()->create([
            'type' => $request->input('type'),
            'name' => $request->input('name'),
            'file_path' => $path,
            'expires_at' => $request->input('expires_at'),
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json(['document' => $doc], 201);
    }

    public function deleteDocument(Request $request, EquipmentDocument $document): JsonResponse
    {
        $equipment = $document->equipment;
        $this->checkTenantAccess($request, $equipment);

        $document->delete();
        return response()->json(null, 204);
    }

    /**
     * Constantes para o frontend.
     */
    public function constants(): JsonResponse
    {
        return response()->json([
            'categories' => Equipment::CATEGORIES,
            'precision_classes' => Equipment::PRECISION_CLASSES,
            'statuses' => Equipment::STATUSES,
            'calibration_types' => [
                'interna' => 'Interna',
                'externa' => 'Externa',
                'rastreada_rbc' => 'Rastreada RBC',
            ],
            'calibration_results' => [
                'aprovado' => 'Aprovado',
                'aprovado_com_ressalva' => 'Aprovado com Ressalva',
                'reprovado' => 'Reprovado',
            ],
            'maintenance_types' => [
                'preventiva' => 'Preventiva',
                'corretiva' => 'Corretiva',
                'ajuste' => 'Ajuste',
                'limpeza' => 'Limpeza',
            ],
            'document_types' => [
                'certificado' => 'Certificado',
                'manual' => 'Manual',
                'foto' => 'Foto',
                'laudo' => 'Laudo',
                'relatorio' => 'Relatório',
            ],
        ]);
    }

    // ─── Export ──────────────────────────────────────────────

    public function exportCsv(Request $request)
    {
        $tid = $this->tenantId($request);

        $equipments = Equipment::where('tenant_id', $tid)
            ->with(['customer:id,name'])
            ->orderBy('code')
            ->get();

        $headers = ['Código', 'Tipo', 'Categoria', 'Marca', 'Modelo', 'Nº Série', 'Cliente', 'Capacidade', 'Unidade', 'Resolução', 'Classe', 'Status', 'Localização', 'Última Calibração', 'Próxima Calibração', 'Intervalo (meses)', 'INMETRO', 'Tag', 'Crítico'];

        $callback = function () use ($equipments, $headers) {
            $f = fopen('php://output', 'w');
            fprintf($f, chr(0xEF) . chr(0xBB) . chr(0xBF)); // BOM UTF-8
            fputcsv($f, $headers, ';');
            foreach ($equipments as $e) {
                fputcsv($f, [
                    $e->code,
                    $e->type,
                    Equipment::CATEGORIES[$e->category] ?? $e->category,
                    $e->brand,
                    $e->model,
                    $e->serial_number,
                    $e->customer?->name,
                    $e->capacity,
                    $e->capacity_unit,
                    $e->resolution,
                    $e->precision_class,
                    Equipment::STATUSES[$e->status] ?? $e->status,
                    $e->location,
                    $e->last_calibration_at?->format('d/m/Y'),
                    $e->next_calibration_at?->format('d/m/Y'),
                    $e->calibration_interval_months,
                    $e->inmetro_number,
                    $e->tag,
                    $e->is_critical ? 'Sim' : 'Não',
                ], ';');
            }
            fclose($f);
        };

        $filename = 'equipamentos_' . now()->format('Ymd_His') . '.csv';

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────

    private function checkTenantAccess(Request $request, Equipment $equipment): void
    {
        if ($equipment->tenant_id !== $this->tenantId($request)) {
            abort(403);
        }
    }
}
