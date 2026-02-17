<?php

namespace App\Services;

use App\Models\EquipmentCalibration;
use App\Models\PaymentReceipt;
use App\Models\Quote;
use App\Models\SystemSetting;
use App\Models\Tenant;
use App\Models\WorkOrder;
use Barryvdh\DomPDF\Facade\Pdf;

class PdfGeneratorService
{
    /**
     * Retorna o path absoluto do logo da empresa no disco, ou null se não existir.
     * Reutiliza a mesma lógica de resolução de company_logo_url → path local.
     */
    public function getCompanyLogoPath(int $tenantId): ?string
    {
        return $this->getCompanySettings($tenantId)['company_logo_path'];
    }

    private function getCompanySettings(int $tenantId): array
    {
        $logoUrl = SystemSetting::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('key', 'company_logo_url')
            ->value('value');

        $tagline = SystemSetting::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('key', 'company_tagline')
            ->value('value');

        $logoPath = null;
        if ($logoUrl) {
            $relative = str_replace('/storage/', '', $logoUrl);
            $full = storage_path('app/public/' . $relative);
            if (file_exists($full)) {
                $logoPath = $full;
            }
        }

        return [
            'company_logo_path' => $logoPath,
            'company_tagline' => $tagline ?: '',
        ];
    }

    public function generateWorkOrderPdf(WorkOrder $wo): string
    {
        $wo->load(['customer', 'items', 'assignee', 'branch', 'equipment', 'seller', 'creator']);

        $tenant = Tenant::find($wo->tenant_id);
        $companySettings = $this->getCompanySettings($wo->tenant_id);
        $pdf = Pdf::loadView('pdf.work-order', ['workOrder' => $wo, 'tenant' => $tenant, ...$companySettings]);
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
        $companySettings = $this->getCompanySettings($quote->tenant_id);
        $pdf = Pdf::loadView('pdf.quote', compact('quote', 'tenant') + $companySettings);
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

        $companySettings = $this->getCompanySettings($receipt->tenant_id);
        $pdf = Pdf::loadView('pdf.payment-receipt', compact('receipt', 'customer', 'tenant', 'items') + $companySettings);
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

        $companySettings = $this->getCompanySettings($equipment?->tenant_id ?? $calibration->tenant_id);
        $pdf = Pdf::loadView('pdf.calibration-certificate', compact(
            'calibration', 'equipment', 'tenant', 'standardWeights', 'workOrder'
        ) + $companySettings);
        $filename = "CERT-{$calibration->certificate_number}.pdf";
        $path = storage_path("app/temp/{$filename}");

        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        $pdf->save($path);

        return $path;
    }
}
