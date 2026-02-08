<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Models\EquipmentCalibration;
use App\Models\Quote;
use App\Models\Tenant;
use App\Models\WorkOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PdfController extends Controller
{
    private function tenant(Request $request): ?Tenant
    {
        return Tenant::find($request->user()->tenant_id);
    }

    /**
     * PDF da Ordem de Serviço
     */
    public function workOrder(Request $request, WorkOrder $workOrder): Response
    {
        $workOrder->load([
            'customer',
            'equipment',
            'assignee',
            'seller',
            'creator',
            'items',
        ]);

        $pdf = Pdf::loadView('pdf.work-order', [
            'workOrder' => $workOrder,
            'tenant' => $this->tenant($request),
        ]);

        $pdf->setPaper('A4', 'portrait');

        return $pdf->download("OS-{$workOrder->number}.pdf");
    }

    /**
     * PDF do Orçamento — Proposta Comercial
     */
    public function quote(Request $request, Quote $quote): Response
    {
        $quote->load([
            'customer',
            'seller',
            'equipments.equipment',
            'equipments.items',
        ]);

        $pdf = Pdf::loadView('pdf.quote', [
            'quote' => $quote,
            'tenant' => $this->tenant($request),
        ]);

        $pdf->setPaper('A4', 'portrait');

        return $pdf->download("Orcamento-{$quote->quote_number}.pdf");
    }

    /**
     * PDF do Certificado de Calibração
     */
    public function calibrationCertificate(Request $request, Equipment $equipment, EquipmentCalibration $calibration): Response
    {
        $equipment->load('customer');
        $calibration->load(['performer', 'approver']);

        $pdf = Pdf::loadView('pdf.calibration-certificate', [
            'equipment' => $equipment,
            'calibration' => $calibration,
            'tenant' => $this->tenant($request),
        ]);

        $pdf->setPaper('A4', 'portrait');

        $certNumber = $calibration->certificate_number ?? 'CAL-' . str_pad($calibration->id, 6, '0', STR_PAD_LEFT);

        return $pdf->download("Certificado-{$certNumber}.pdf");
    }

    /**
     * Relatório geral em CSV
     */
    public function reportExport(Request $request, string $type): Response
    {
        // Delegate to ReportController to get data, then export CSV
        $controller = app(\App\Http\Controllers\Api\V1\ReportController::class);
        $method = match ($type) {
            'work-orders' => 'workOrders',
            'productivity' => 'productivity',
            'financial' => 'financial',
            'commissions' => 'commissions',
            'profitability' => 'profitability',
            'quotes' => 'quotes',
            'service-calls' => 'serviceCalls',
            'technician-cash' => 'technicianCash',
            default => null,
        };

        if (!$method) {
            return response()->json(['error' => 'Tipo de relatório inválido'], 422);
        }

        $response = $controller->$method($request);
        $data = $response->getData(true);

        // Flatten and export as CSV
        $rows = $data['data'] ?? $data['rows'] ?? [];
        if (empty($rows)) {
            return response()->json(['error' => 'Sem dados para exportar'], 404);
        }

        $headers = array_keys(is_array($rows[0]) ? $rows[0] : (array) $rows[0]);
        $csv = implode(',', $headers) . "\n";
        foreach ($rows as $row) {
            $row = is_array($row) ? $row : (array) $row;
            $csv .= implode(',', array_map(fn($v) => '"' . str_replace('"', '""', is_array($v) ? json_encode($v) : (string)$v) . '"', array_values($row))) . "\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=relatorio-{$type}.csv",
        ]);
    }
}
