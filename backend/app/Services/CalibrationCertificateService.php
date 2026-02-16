<?php

namespace App\Services;

use App\Models\EquipmentCalibration;
use App\Models\NumberingSequence;
use App\Models\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CalibrationCertificateService
{
    /**
     * Generate ISO 17025 calibration certificate PDF.
     *
     * The Blade template uses Eloquent models directly:
     * $calibration, $equipment, $standardWeights, $tenant, $workOrder
     */
    public function generate(EquipmentCalibration $calibration): \Barryvdh\DomPDF\PDF
    {
        $calibration->load([
            'equipment.customer',
            'performer',
            'approver',
            'workOrder',
            'standardWeights',
            'readings',
            'excentricityTests',
        ]);

        // P1.3: Checklist é PRÉ-REQUISITO para gerar certificado
        if ($calibration->workOrder && $calibration->workOrder->checklist_id) {
            $totalItems = $calibration->workOrder->checklist->items()->where('is_required', true)->count();
            $answeredItems = $calibration->workOrder->checklistResponses()->count();
            if ($totalItems > 0 && $answeredItems < $totalItems) {
                throw new \DomainException(
                    "Checklist incompleto ({$answeredItems}/{$totalItems} itens respondidos). Todos os itens obrigatórios devem ser preenchidos antes de gerar o certificado."
                );
            }
        }

        $tenant = Tenant::find($calibration->tenant_id);

        if (empty($calibration->approved_by) && $calibration->performed_by) {
            $calibration->approved_by = $calibration->performed_by;
            $calibration->save();
            $calibration->load('approver');
        }
        if (empty(trim($calibration->laboratory ?? ''))) {
            $calibration->laboratory = $tenant?->name ?? 'Laboratório de Calibração';
            $calibration->save();
        }

        // Auto-generate certificate number if empty
        if (empty($calibration->certificate_number)) {
            $calibration->certificate_number = $this->generateCertificateNumber($calibration->tenant_id);
            $calibration->save();
        }

        $pdf = Pdf::loadView('pdf.calibration-certificate', [
            'calibration' => $calibration,
            'equipment' => $calibration->equipment,
            'standardWeights' => $calibration->standardWeights,
            'tenant' => $tenant,
            'workOrder' => $calibration->workOrder,
        ]);

        $pdf->setPaper('a4', 'portrait');
        $pdf->setOption('isHtml5ParserEnabled', true);
        $pdf->setOption('isRemoteEnabled', false);
        $pdf->setOption('defaultFont', 'DejaVu Sans');

        return $pdf;
    }

    /**
     * Generate and save PDF to storage, return relative path.
     */
    public function generateAndStore(EquipmentCalibration $calibration): string
    {
        $pdf = $this->generate($calibration);
        $fileName = "certificates/calibration_{$calibration->id}_{$calibration->certificate_number}.pdf";
        $path = storage_path("app/public/{$fileName}");

        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        file_put_contents($path, $pdf->output());

        $calibration->update(['certificate_pdf_path' => "public/{$fileName}"]);

        return $fileName;
    }

    private function generateCertificateNumber(int $tenantId): string
    {
        $sequence = NumberingSequence::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('entity', 'calibration_certificate')
            ->first();

        if ($sequence) {
            return $sequence->generateNext();
        }

        // Fallback: simple sequential number
        $lastNumber = EquipmentCalibration::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('certificate_number')
            ->max(DB::raw("CAST(REPLACE(certificate_number, 'CERT-', '') AS UNSIGNED)"));

        $next = ($lastNumber ?? 0) + 1;

        return 'CERT-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }
}
