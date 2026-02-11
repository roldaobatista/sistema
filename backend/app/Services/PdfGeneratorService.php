<?php

namespace App\Services;

use App\Models\EquipmentCalibration;
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

    public function generateCalibrationPdf(EquipmentCalibration $calibration): string
    {
        $calibration->load(['equipment', 'equipment.customer', 'performer', 'approver']);

        $equipment = $calibration->equipment;
        $tenant = Tenant::find($equipment?->tenant_id ?? $calibration->tenant_id);
        $pdf = Pdf::loadView('pdf.calibration-certificate', compact('calibration', 'equipment', 'tenant'));
        $filename = "CERT-{$calibration->certificate_number}.pdf";
        $path = storage_path("app/temp/{$filename}");

        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        $pdf->save($path);

        return $path;
    }
}
