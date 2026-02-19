<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Models\ServiceCall;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class ClientPortalController extends Controller
{
    // ─── #42 Abertura de Chamado via Portal ─────────────────────

    public function createServiceCallFromPortal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => 'required|string|max:255',
            'description' => 'required|string',
            'priority' => 'nullable|string|in:low,medium,high,critical',
            'equipment_id' => 'nullable|integer',
            'attachments' => 'nullable|array',
            'attachments.*' => 'file|max:10240',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $customerId = $request->user()->customer_id ?? $request->user()->id;

        $callId = DB::table('service_calls')->insertGetId([
            'tenant_id' => $tenantId,
            'customer_id' => $customerId,
            'subject' => $data['subject'],
            'description' => $data['description'],
            'priority' => $data['priority'] ?? 'medium',
            'equipment_id' => $data['equipment_id'] ?? null,
            'status' => 'open',
            'source' => 'portal',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        // Handle attachments
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $path = $file->store("service-calls/{$callId}", 'public');
                DB::table('service_call_attachments')->insert([
                    'service_call_id' => $callId,
                    'file_path' => $path,
                    'file_name' => $file->getClientOriginalName(),
                    'file_size' => $file->getSize(),
                    'created_at' => now(),
                ]);
            }
        }

        return response()->json([
            'message' => 'Service call created',
            'service_call_id' => $callId,
        ], 201);
    }

    // ─── #43 Acompanhamento de OS em Tempo Real ────────────────

    public function trackWorkOrders(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $customerId = $request->user()->customer_id ?? $request->user()->id;

        $workOrders = WorkOrder::where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->whereNotIn('status', [WorkOrder::STATUS_CANCELLED])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get(['id', 'status', 'priority', 'created_at', 'sla_deadline', 'assigned_to', 'completed_at']);

        $workOrders->each(function ($wo) {
            $wo->timeline = DB::table('work_order_status_history')
                ->where('work_order_id', $wo->id)
                ->orderBy('created_at')
                ->get(['from_status', 'to_status', 'notes', 'created_at']);

            $wo->technician_name = $wo->assigned_to
                ? DB::table('users')->where('id', $wo->assigned_to)->value('name')
                : null;
        });

        return response()->json($workOrders);
    }

    public function trackServiceCalls(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $customerId = $request->user()->customer_id ?? $request->user()->id;

        $calls = DB::table('service_calls')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json($calls);
    }

    // ─── #44 Histórico de Certificados de Calibração ───────────

    public function calibrationCertificates(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $customerId = $request->user()->customer_id ?? $request->user()->id;

        $certificates = DB::table('calibration_certificates')
            ->join('equipments', 'calibration_certificates.equipment_id', '=', 'equipments.id')
            ->where('equipments.tenant_id', $tenantId)
            ->where('equipments.customer_id', $customerId)
            ->select(
                'calibration_certificates.*',
                'equipments.name as equipment_name',
                'equipments.serial_number'
            )
            ->orderByDesc('calibration_certificates.date')
            ->paginate(20);

        return response()->json($certificates);
    }

    public function downloadCertificate(Request $request, int $certificateId): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $cert = DB::table('calibration_certificates')
            ->where('id', $certificateId)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$cert) return response()->json(['message' => 'Not found'], 404);

        return response()->json([
            'certificate' => $cert,
            'download_url' => $cert->file_path ? asset('storage/' . $cert->file_path) : null,
            'qr_verification_url' => config('app.url') . "/api/v1/verify-certificate/{$cert->verification_code}",
        ]);
    }
}
