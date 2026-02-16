<?php

namespace App\Services;

use App\Models\EquipmentCalibration;
use App\Models\PaymentReceipt;
use App\Models\Quote;
use App\Models\Tenant;
use App\Models\WorkOrder;
use Barryvdh\DomPDF\Facade\Pdf;

class PdfGeneratorService
{
    public function generateWorkOrderPdf(WorkOrder $wo): string
    {
        $wo->load(['customer', 'items', 'assignee', 'branch', 'equipment', 'seller', 'creator']);

        $tenant = Tenant::find($wo->tenant_id);
        $pdf = Pdf::loadView('pdf.work-order', ['workOrder' => $wo, 'tenant' => $tenant]);
        $filename = "OS-{$wo->business_number}.pdf";
        $path = storage_path("app/temp/{$filename}");

        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        $pdf->save($path);

        return $path;
    }

    public function generateQuotePdf(Quote $quote): string
    {
        $quote->load([
            'customer',
            'seller',
            'equipments.equipment',
            'equipments.items.product',
            'equipments.items.service',
        ]);

        $tenant = Tenant::find($quote->tenant_id);
        $pdf = Pdf::loadView('pdf.quote', compact('quote', 'tenant'));
        $filename = "ORC-{$quote->quote_number}.pdf";
        $path = storage_path("app/temp/{$filename}");

        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        $pdf->save($path);

        return $path;
    }

    public function generateReceiptPdf(PaymentReceipt $receipt): string
    {
        $receipt->load(['customer']);

        $customer = $receipt->customer;
        $tenant = Tenant::find($receipt->tenant_id);
        $items = $receipt->items ?? [];

        $pdf = Pdf::loadView('pdf.payment-receipt', compact('receipt', 'customer', 'tenant', 'items'));
        $filename = "RECIBO-{$receipt->receipt_number}.pdf";
        $path = storage_path("app/temp/{$filename}");

        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        $pdf->save($path);

        return $path;
    }

    public function generateCalibrationPdf(EquipmentCalibration $calibration): string
    {
        $calibration->load(['equipment', 'equipment.customer', 'performer', 'approver', 'readings', 'excentricityTests']);

        $equipment = $calibration->equipment;
        $tenant = Tenant::find($equipment?->tenant_id ?? $calibration->tenant_id);

        // Busca pesos padrão vinculados à calibração (via work_order_id ou standard_weight_ids no JSON)
        $standardWeights = collect();
        if ($calibration->work_order_id) {
            $workOrder = WorkOrder::find($calibration->work_order_id);
        } else {
            $workOrder = null;
        }

        // Se houver pesos padrão registrados nos dados da calibração
        $weightIds = $calibration->standard_weight_ids ?? [];
        if (!empty($weightIds)) {
            $standardWeights = \App\Models\StandardWeight::whereIn('id', $weightIds)->get();
        }

        $pdf = Pdf::loadView('pdf.calibration-certificate', compact(
            'calibration', 'equipment', 'tenant', 'standardWeights', 'workOrder'
        ));
        $filename = "CERT-{$calibration->certificate_number}.pdf";
        $path = storage_path("app/temp/{$filename}");

        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        $pdf->save($path);

        return $path;
    }
}
