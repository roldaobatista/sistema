<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class MetrologyQualityController extends Controller
{
    // ─── #45 Registro de Não Conformidades (RNC) ────────────────

    public function nonConformances(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        return response()->json(
            DB::table('non_conformances')->where('company_id', $tenantId)
                ->orderByDesc('created_at')->paginate(20)
        );
    }

    public function storeNonConformance(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'type' => 'required|string|in:equipment,process,service,product',
            'severity' => 'required|string|in:minor,major,critical',
            'equipment_id' => 'nullable|integer',
            'work_order_id' => 'nullable|integer',
            'corrective_action' => 'nullable|string',
            'responsible_id' => 'nullable|integer|exists:users,id',
            'deadline' => 'nullable|date',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $number = 'RNC-' . now()->format('Y') . '-' . str_pad(
            DB::table('non_conformances')->where('company_id', $tenantId)
                ->whereYear('created_at', now()->year)->count() + 1,
            4, '0', STR_PAD_LEFT
        );

        $id = DB::table('non_conformances')->insertGetId(array_merge($data, [
            'company_id' => $tenantId,
            'number' => $number,
            'status' => 'open',
            'reported_by' => $request->user()->id,
            'created_at' => now(), 'updated_at' => now(),
        ]));

        return response()->json(['id' => $id, 'number' => $number], 201);
    }

    public function updateNonConformance(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'status' => 'sometimes|string|in:open,investigating,correcting,closed,rejected',
            'corrective_action' => 'sometimes|string',
            'root_cause' => 'sometimes|string',
            'preventive_action' => 'sometimes|string',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $data['updated_at'] = now();
        if (isset($data['status']) && $data['status'] === 'closed') {
            $data['closed_at'] = now();
            $data['closed_by'] = $request->user()->id;
        }

        DB::table('non_conformances')
            ->where('id', $id)->where('company_id', $tenantId)->update($data);

        return response()->json(['message' => 'Updated']);
    }

    // ─── #46 Certificado com QR Code de Verificação ────────────

    public function generateCertificateQR(Request $request, int $certificateId): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $cert = DB::table('calibration_certificates')
            ->where('id', $certificateId)->where('company_id', $tenantId)->first();

        if (!$cert) return response()->json(['message' => 'Not found'], 404);

        $verificationCode = $cert->verification_code ?? Str::uuid()->toString();

        if (!$cert->verification_code) {
            DB::table('calibration_certificates')
                ->where('id', $certificateId)
                ->update(['verification_code' => $verificationCode, 'updated_at' => now()]);
        }

        $verifyUrl = config('app.url') . "/api/verify-certificate/{$verificationCode}";

        return response()->json([
            'certificate_id' => $certificateId,
            'verification_code' => $verificationCode,
            'verification_url' => $verifyUrl,
            'qr_data' => $verifyUrl,
        ]);
    }

    public function verifyCertificate(string $code): JsonResponse
    {
        $cert = DB::table('calibration_certificates')
            ->where('verification_code', $code)->first();

        if (!$cert) {
            return response()->json(['valid' => false, 'message' => 'Certificate not found'], 404);
        }

        return response()->json([
            'valid' => true,
            'certificate_number' => $cert->number ?? $cert->id,
            'equipment' => DB::table('equipments')->find($cert->equipment_id)?->name,
            'date' => $cert->date,
            'expires_at' => $cert->expires_at,
            'status' => $cert->expires_at && Carbon::parse($cert->expires_at)->isPast() ? 'expired' : 'valid',
        ]);
    }

    // ─── #47 Controle de Incerteza de Medição ──────────────────

    public function measurementUncertainty(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        return response()->json(
            DB::table('measurement_uncertainties')
                ->where('company_id', $tenantId)
                ->orderByDesc('created_at')->paginate(20)
        );
    }

    public function storeMeasurementUncertainty(Request $request): JsonResponse
    {
        $data = $request->validate([
            'equipment_id' => 'required|integer',
            'calibration_id' => 'nullable|integer',
            'measurement_type' => 'required|string',
            'nominal_value' => 'required|numeric',
            'measured_values' => 'required|array|min:3',
            'measured_values.*' => 'numeric',
            'unit' => 'required|string|max:20',
            'coverage_factor' => 'nullable|numeric|min:1|max:4',
        ]);

        $values = collect($data['measured_values']);
        $mean = $values->avg();
        $n = $values->count();
        $k = $data['coverage_factor'] ?? 2;

        // Type A uncertainty (from measurements)
        $variance = $values->reduce(fn ($carry, $v) => $carry + pow($v - $mean, 2), 0) / ($n - 1);
        $stdDev = sqrt($variance);
        $typeA = $stdDev / sqrt($n);

        // Combined uncertainty (simplified — Type A only)
        $combined = $typeA;
        $expanded = $combined * $k;

        $id = DB::table('measurement_uncertainties')->insertGetId([
            'company_id' => $request->user()->current_tenant_id,
            'equipment_id' => $data['equipment_id'],
            'calibration_id' => $data['calibration_id'] ?? null,
            'measurement_type' => $data['measurement_type'],
            'nominal_value' => $data['nominal_value'],
            'mean_value' => round($mean, 6),
            'std_deviation' => round($stdDev, 6),
            'type_a_uncertainty' => round($typeA, 6),
            'combined_uncertainty' => round($combined, 6),
            'expanded_uncertainty' => round($expanded, 6),
            'coverage_factor' => $k,
            'unit' => $data['unit'],
            'measured_values' => json_encode($data['measured_values']),
            'created_by' => $request->user()->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json([
            'id' => $id,
            'mean' => round($mean, 6),
            'expanded_uncertainty' => round($expanded, 6),
            'result' => round($mean, 4) . ' ± ' . round($expanded, 4) . ' ' . $data['unit'] . " (k={$k})",
        ], 201);
    }

    // ─── #48 Agenda de Calibração com Recall Automático ────────

    public function calibrationSchedule(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $days = $request->input('days', 90);

        $upcoming = DB::table('equipments')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('next_calibration_date')
            ->where('next_calibration_date', '<=', now()->addDays($days))
            ->where('is_active', true)
            ->join('customers', 'equipments.customer_id', '=', 'customers.id')
            ->select('equipments.*', 'customers.nome_fantasia as customer_name')
            ->orderBy('next_calibration_date')
            ->get()
            ->map(function ($eq) {
                $daysUntil = now()->diffInDays(Carbon::parse($eq->next_calibration_date), false);
                $eq->days_until = $daysUntil;
                $eq->urgency = $daysUntil <= 0 ? 'overdue' : ($daysUntil <= 15 ? 'urgent' : ($daysUntil <= 30 ? 'soon' : 'scheduled'));
                return $eq;
            });

        return response()->json([
            'total' => $upcoming->count(),
            'overdue' => $upcoming->where('urgency', 'overdue')->count(),
            'urgent' => $upcoming->where('urgency', 'urgent')->count(),
            'schedule' => $upcoming,
        ]);
    }

    public function triggerRecall(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $overdue = DB::table('equipments')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('next_calibration_date')
            ->where('next_calibration_date', '<=', now())
            ->where('is_active', true)
            ->get();

        $recalled = 0;
        foreach ($overdue as $eq) {
            // Check no recall sent recently
            $recentRecall = DB::table('recall_logs')
                ->where('equipment_id', $eq->id)
                ->where('created_at', '>=', now()->subDays(7))
                ->exists();

            if (!$recentRecall) {
                DB::table('recall_logs')->insert([
                    'company_id' => $tenantId,
                    'equipment_id' => $eq->id,
                    'customer_id' => $eq->customer_id,
                    'type' => 'calibration_overdue',
                    'status' => 'sent',
                    'created_at' => now(),
                ]);
                $recalled++;
            }
        }

        return response()->json([
            'message' => "{$recalled} recall notifications triggered",
            'total_overdue' => $overdue->count(),
        ]);
    }
}
