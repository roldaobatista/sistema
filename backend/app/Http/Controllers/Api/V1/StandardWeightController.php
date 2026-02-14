<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StandardWeight;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class StandardWeightController extends Controller
{
    private function tenantId(Request $request): int
    {
        return $request->user()->current_tenant_id;
    }

    public function index(Request $request): JsonResponse
    {
        $query = StandardWeight::where('tenant_id', $this->tenantId($request));

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhere('certificate_number', 'like', "%{$search}%")
                    ->orWhere('manufacturer', 'like', "%{$search}%");
            });
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($request->input('expiring')) {
            $query->expiring((int) $request->input('expiring_days', 30));
        }

        if ($request->boolean('expired')) {
            $query->expired();
        }

        if ($precisionClass = $request->input('precision_class')) {
            $query->where('precision_class', $precisionClass);
        }

        $sortBy = $request->input('sort_by', 'code');
        $sortDir = $request->input('sort_dir', 'asc');
        $query->orderBy($sortBy, $sortDir);

        $perPage = min((int) $request->input('per_page', 25), 100);
        $weights = $query->paginate($perPage);

        return response()->json($weights);
    }

    public function show(Request $request, StandardWeight $standardWeight): JsonResponse
    {
        if ($standardWeight->tenant_id !== $this->tenantId($request)) {
            return response()->json(['message' => 'Não autorizado'], 403);
        }

        $standardWeight->load('calibrations.equipment');

        return response()->json(['data' => $standardWeight]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nominal_value' => 'required|numeric|min:0',
            'unit' => ['required', Rule::in(StandardWeight::UNITS)],
            'serial_number' => 'nullable|string|max:100',
            'manufacturer' => 'nullable|string|max:150',
            'precision_class' => ['nullable', Rule::in(array_keys(StandardWeight::PRECISION_CLASSES))],
            'material' => 'nullable|string|max:100',
            'shape' => ['nullable', Rule::in(array_keys(StandardWeight::SHAPES))],
            'certificate_number' => 'nullable|string|max:100',
            'certificate_date' => 'nullable|date',
            'certificate_expiry' => 'nullable|date|after_or_equal:certificate_date',
            'certificate_file' => 'nullable|string|max:500',
            'laboratory' => 'nullable|string|max:200',
            'status' => ['nullable', Rule::in(array_keys(StandardWeight::STATUSES))],
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $tenantId = $this->tenantId($request);
            $data['tenant_id'] = $tenantId;
            $data['code'] = StandardWeight::generateCode($tenantId);

            $weight = StandardWeight::create($data);

            DB::commit();

            return response()->json([
                'message' => 'Peso padrão cadastrado com sucesso',
                'data' => $weight,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar peso padrão', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao criar peso padrão'], 500);
        }
    }

    public function update(Request $request, StandardWeight $standardWeight): JsonResponse
    {
        if ($standardWeight->tenant_id !== $this->tenantId($request)) {
            return response()->json(['message' => 'Não autorizado'], 403);
        }

        $data = $request->validate([
            'nominal_value' => 'sometimes|numeric|min:0',
            'unit' => ['sometimes', Rule::in(StandardWeight::UNITS)],
            'serial_number' => 'nullable|string|max:100',
            'manufacturer' => 'nullable|string|max:150',
            'precision_class' => ['nullable', Rule::in(array_keys(StandardWeight::PRECISION_CLASSES))],
            'material' => 'nullable|string|max:100',
            'shape' => ['nullable', Rule::in(array_keys(StandardWeight::SHAPES))],
            'certificate_number' => 'nullable|string|max:100',
            'certificate_date' => 'nullable|date',
            'certificate_expiry' => 'nullable|date|after_or_equal:certificate_date',
            'certificate_file' => 'nullable|string|max:500',
            'laboratory' => 'nullable|string|max:200',
            'status' => ['nullable', Rule::in(array_keys(StandardWeight::STATUSES))],
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $standardWeight->update($data);
            DB::commit();

            return response()->json([
                'message' => 'Peso padrão atualizado com sucesso',
                'data' => $standardWeight->fresh(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao atualizar peso padrão', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao atualizar peso padrão'], 500);
        }
    }

    public function destroy(Request $request, StandardWeight $standardWeight): JsonResponse
    {
        if ($standardWeight->tenant_id !== $this->tenantId($request)) {
            return response()->json(['message' => 'Não autorizado'], 403);
        }

        $calibrationCount = $standardWeight->calibrations()->count();
        if ($calibrationCount > 0) {
            return response()->json([
                'message' => "Não é possível excluir. Este peso padrão está vinculado a {$calibrationCount} calibração(ões).",
            ], 409);
        }

        try {
            DB::transaction(fn () => $standardWeight->delete());
            return response()->json(['message' => 'Peso padrão excluído com sucesso']);
        } catch (\Exception $e) {
            Log::error('Erro ao excluir peso padrão', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir peso padrão'], 500);
        }
    }

    public function expiring(Request $request): JsonResponse
    {
        $days = (int) $request->input('days', 30);

        $expiring = StandardWeight::where('tenant_id', $this->tenantId($request))
            ->expiring($days)
            ->orderBy('certificate_expiry')
            ->get();

        $expired = StandardWeight::where('tenant_id', $this->tenantId($request))
            ->expired()
            ->orderBy('certificate_expiry')
            ->get();

        return response()->json([
            'expiring' => $expiring,
            'expired' => $expired,
            'expiring_count' => $expiring->count(),
            'expired_count' => $expired->count(),
        ]);
    }

    public function constants(): JsonResponse
    {
        return response()->json([
            'statuses' => StandardWeight::STATUSES,
            'precision_classes' => StandardWeight::PRECISION_CLASSES,
            'units' => StandardWeight::UNITS,
            'shapes' => StandardWeight::SHAPES,
        ]);
    }

    public function exportCsv(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $weights = StandardWeight::where('tenant_id', $this->tenantId($request))
            ->orderBy('code')
            ->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="pesos_padrao.csv"',
        ];

        return response()->stream(function () use ($weights) {
            $handle = fopen('php://output', 'w');
            fprintf($handle, chr(0xEF) . chr(0xBB) . chr(0xBF)); // UTF-8 BOM

            fputcsv($handle, [
                'Código', 'Valor Nominal', 'Unidade', 'Nº Série', 'Fabricante',
                'Classe', 'Material', 'Formato', 'Nº Certificado',
                'Data Certificado', 'Validade', 'Laboratório', 'Status',
            ], ';');

            foreach ($weights as $w) {
                fputcsv($handle, [
                    $w->code,
                    number_format((float) $w->nominal_value, 4, ',', '.'),
                    $w->unit,
                    $w->serial_number ?? '',
                    $w->manufacturer ?? '',
                    $w->precision_class ?? '',
                    $w->material ?? '',
                    $w->shape ? (StandardWeight::SHAPES[$w->shape] ?? $w->shape) : '',
                    $w->certificate_number ?? '',
                    $w->certificate_date?->format('d/m/Y') ?? '',
                    $w->certificate_expiry?->format('d/m/Y') ?? '',
                    $w->laboratory ?? '',
                    StandardWeight::STATUSES[$w->status]['label'] ?? $w->status,
                ], ';');
            }

            fclose($handle);
        }, 200, $headers);
    }
}
