<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Models\EquipmentCalibration;
use App\Models\EquipmentMaintenance;
use App\Models\EquipmentDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EquipmentController extends Controller
{
    /**
     * Listagem com filtros avançados.
     */
    public function index(Request $request): JsonResponse
    {
        $q = Equipment::where('tenant_id', $request->user()->tenant_id)
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
        $this->authorize($request, $equipment);

        $equipment->load([
            'customer:id,name,document,phone',
            'responsible:id,name',
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
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'type' => 'required|string|max:100',
            'category' => 'nullable|string|max:40',
            'brand' => 'nullable|string|max:100',
            'manufacturer' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string',
            'capacity' => 'nullable|numeric',
            'capacity_unit' => 'nullable|string|max:10',
            'resolution' => 'nullable|numeric',
            'precision_class' => 'nullable|in:I,II,III,IIII',
            'status' => 'nullable|string|max:30',
            'location' => 'nullable|string|max:150',
            'responsible_user_id' => 'nullable|exists:users,id',
            'purchase_date' => 'nullable|date',
            'purchase_value' => 'nullable|numeric',
            'warranty_expires_at' => 'nullable|date',
            'calibration_interval_months' => 'nullable|integer|min:1',
            'inmetro_number' => 'nullable|string|max:50',
            'tag' => 'nullable|string|max:50',
            'is_critical' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        $data['tenant_id'] = $request->user()->tenant_id;
        $data['code'] = Equipment::generateCode($data['tenant_id']);

        $equipment = Equipment::create($data);

        return response()->json(['equipment' => $equipment->load('customer:id,name')], 201);
    }

    /**
     * Atualizar equipamento.
     */
    public function update(Request $request, Equipment $equipment): JsonResponse
    {
        $this->authorize($request, $equipment);

        $data = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'type' => 'nullable|string|max:100',
            'category' => 'nullable|string|max:40',
            'brand' => 'nullable|string|max:100',
            'manufacturer' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string',
            'capacity' => 'nullable|numeric',
            'capacity_unit' => 'nullable|string|max:10',
            'resolution' => 'nullable|numeric',
            'precision_class' => 'nullable|in:I,II,III,IIII',
            'status' => 'nullable|string|max:30',
            'location' => 'nullable|string|max:150',
            'responsible_user_id' => 'nullable|exists:users,id',
            'purchase_date' => 'nullable|date',
            'purchase_value' => 'nullable|numeric',
            'warranty_expires_at' => 'nullable|date',
            'calibration_interval_months' => 'nullable|integer|min:1',
            'inmetro_number' => 'nullable|string|max:50',
            'tag' => 'nullable|string|max:50',
            'is_critical' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        $equipment->update($data);

        return response()->json(['equipment' => $equipment->fresh('customer:id,name')]);
    }

    /**
     * Excluir (soft delete).
     */
    public function destroy(Request $request, Equipment $equipment): JsonResponse
    {
        $this->authorize($request, $equipment);
        $equipment->delete();
        return response()->json(null, 204);
    }

    /**
     * Dashboard KPIs dos equipamentos.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $tid = $request->user()->tenant_id;

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
        $tid = $request->user()->tenant_id;

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

    public function calibrationHistory(Equipment $equipment): JsonResponse
    {
        $calibrations = $equipment->calibrations()
            ->with(['performer:id,name', 'approver:id,name'])
            ->get();

        return response()->json(['calibrations' => $calibrations]);
    }

    public function addCalibration(Request $request, Equipment $equipment): JsonResponse
    {
        $this->authorize($request, $equipment);

        $data = $request->validate([
            'calibration_date' => 'required|date',
            'calibration_type' => 'required|in:interna,externa,rastreada_rbc',
            'result' => 'required|in:aprovado,aprovado_com_ressalva,reprovado',
            'laboratory' => 'nullable|string|max:150',
            'certificate_number' => 'nullable|string|max:50',
            'uncertainty' => 'nullable|string|max:50',
            'errors_found' => 'nullable|array',
            'corrections_applied' => 'nullable|string',
            'cost' => 'nullable|numeric',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'notes' => 'nullable|string',
        ]);

        $data['performed_by'] = $request->user()->id;

        // Calcular próximo vencimento
        if ($equipment->calibration_interval_months) {
            $data['next_due_date'] = \Carbon\Carbon::parse($data['calibration_date'])
                ->addMonths($equipment->calibration_interval_months);
        }

        $calibration = $equipment->calibrations()->create($data);

        // Atualizar equipamento
        $equipment->update([
            'last_calibration_at' => $data['calibration_date'],
            'next_calibration_at' => $data['next_due_date'] ?? null,
            'certificate_number' => $data['certificate_number'] ?? $equipment->certificate_number,
            'status' => 'ativo',
        ]);

        return response()->json(['calibration' => $calibration], 201);
    }

    // ─── Manutenções ────────────────────────────────────────

    public function addMaintenance(Request $request, Equipment $equipment): JsonResponse
    {
        $this->authorize($request, $equipment);

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
        $maintenance = $equipment->maintenances()->create($data);

        return response()->json(['maintenance' => $maintenance], 201);
    }

    // ─── Documentos ─────────────────────────────────────────

    public function uploadDocument(Request $request, Equipment $equipment): JsonResponse
    {
        $this->authorize($request, $equipment);

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
        $this->authorize($request, $equipment);

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
        $tid = $request->user()->tenant_id;

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

    private function authorize(Request $request, Equipment $equipment): void
    {
        if ($equipment->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }
    }
}
