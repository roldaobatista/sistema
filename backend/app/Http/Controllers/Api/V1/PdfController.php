<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Models\EquipmentCalibration;
use App\Models\Quote;
use App\Models\Tenant;
use App\Models\WorkOrder;
use App\Services\CalibrationCertificateService;
use App\Support\ReportExportAuthorization;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Spatie\Permission\Exceptions\PermissionDoesNotExist;
use Symfony\Component\HttpFoundation\Response;

class PdfController extends Controller
{
    use ResolvesCurrentTenant;

    private function tenant(): ?Tenant
    {
        return Tenant::find($this->resolvedTenantId());
    }

    public function workOrder(Request $request, WorkOrder $workOrder): Response
    {
        $workOrder->load([
            'customer',
            'equipment',
            'technicians',
            'assignee',
            'seller',
            'creator',
            'items',
        ]);

        $pdf = Pdf::loadView('pdf.work-order', [
            'workOrder' => $workOrder,
            'tenant' => $this->tenant(),
        ]);

        $pdf->setPaper('A4', 'portrait');

        return $pdf->download("OS-{$workOrder->business_number}.pdf");
    }

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
            'tenant' => $this->tenant(),
        ]);

        $pdf->setPaper('A4', 'portrait');

        return $pdf->download("Orcamento-{$quote->quote_number}.pdf");
    }

    public function calibrationCertificate(Request $request, Equipment $equipment, EquipmentCalibration $calibration): Response|StreamedResponse
    {
        $storedPath = $calibration->certificate_pdf_path;
        $fullPath = $storedPath ? storage_path('app/' . $storedPath) : null;

        if ($fullPath && is_file($fullPath)) {
            $certNumber = $calibration->certificate_number ?? 'CAL-' . str_pad($calibration->id, 6, '0', STR_PAD_LEFT);

            return response()->streamDownload(
                static function () use ($fullPath) {
                    echo file_get_contents($fullPath);
                },
                "Certificado-{$certNumber}.pdf",
                ['Content-Type' => 'application/pdf'],
                'inline'
            );
        }

        $service = app(CalibrationCertificateService::class);
        $fileName = $service->generateAndStore($calibration);
        $path = storage_path('app/public/' . $fileName);
        $certNumber = $calibration->certificate_number ?? 'CAL-' . str_pad($calibration->id, 6, '0', STR_PAD_LEFT);

        return response()->streamDownload(
            static function () use ($path) {
                echo file_get_contents($path);
            },
            "Certificado-{$certNumber}.pdf",
            ['Content-Type' => 'application/pdf'],
            'inline'
        );
    }

    public function reportExport(Request $request, string $type): Response
    {
        // Permissão já validada pelo middleware CheckReportExportPermission
        $type = ReportExportAuthorization::normalizeType($type);

        $controller = app(ReportController::class);
        $method = match ($type) {
            'work-orders' => 'workOrders',
            'productivity' => 'productivity',
            'financial' => 'financial',
            'commissions' => 'commissions',
            'profitability' => 'profitability',
            'quotes' => 'quotes',
            'service-calls' => 'serviceCalls',
            'technician-cash' => 'technicianCash',
            'crm' => 'crm',
            'equipments' => 'equipments',
            'suppliers' => 'suppliers',
            'stock' => 'stock',
            'customers' => 'customers',
            default => null,
        };

        if (!$method) {
            abort(422, 'Tipo de relatorio invalido.');
        }

        $response = $controller->$method($request);
        $data = $response->getData(true);
        $rows = $this->rowsForReportType($type, $data);

        if (empty($rows)) {
            abort(404, 'Sem dados para exportar.');
        }

        $csv = $this->toCsv($rows);

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=relatorio-{$type}.csv",
        ]);
    }

    private function rowsForReportType(string $type, array $data): array
    {
        $single = static function (string $section, mixed $payload): array {
            $row = ['section' => $section];
            foreach ((array) $payload as $key => $value) {
                if ($key === 'period') {
                    continue;
                }
                $row[$key] = $value;
            }
            return [$row];
        };

        $multi = static function (string $section, array $items): array {
            return array_map(static function ($item) use ($section) {
                $row = ['section' => $section];
                foreach ((array) $item as $key => $value) {
                    $row[$key] = $value;
                }
                return $row;
            }, $items);
        };

        return match ($type) {
            'work-orders' => array_merge(
                $multi('by_status', $data['by_status'] ?? []),
                $multi('by_priority', $data['by_priority'] ?? []),
                $multi('monthly', $data['monthly'] ?? []),
                $single('summary', ['avg_completion_hours' => $data['avg_completion_hours'] ?? null])
            ),
            'productivity' => array_merge(
                $multi('technicians', $data['technicians'] ?? []),
                $multi('completed_by_tech', $data['completed_by_tech'] ?? [])
            ),
            'financial' => array_merge(
                $single('receivable', $data['receivable'] ?? []),
                $single('payable', $data['payable'] ?? []),
                $multi('expenses_by_category', $data['expenses_by_category'] ?? []),
                $multi('monthly_flow', $data['monthly_flow'] ?? [])
            ),
            'commissions' => array_merge(
                $multi('by_technician', $data['by_technician'] ?? []),
                $multi('by_status', $data['by_status'] ?? [])
            ),
            'profitability' => $single('profitability', $data),
            'quotes' => array_merge(
                $multi('by_status', $data['by_status'] ?? []),
                $multi('by_seller', $data['by_seller'] ?? []),
                $single('summary', [
                    'total' => $data['total'] ?? 0,
                    'approved' => $data['approved'] ?? 0,
                    'conversion_rate' => $data['conversion_rate'] ?? 0,
                ])
            ),
            'service-calls' => array_merge(
                $multi('by_status', $data['by_status'] ?? []),
                $multi('by_priority', $data['by_priority'] ?? []),
                $multi('by_technician', $data['by_technician'] ?? []),
                $single('summary', [
                    'total' => $data['total'] ?? 0,
                    'completed' => $data['completed'] ?? 0,
                ])
            ),
            'technician-cash' => array_merge(
                $multi('funds', $data['funds'] ?? []),
                $single('summary', [
                    'total_balance' => $data['total_balance'] ?? 0,
                    'total_credits' => $data['total_credits'] ?? 0,
                    'total_debits' => $data['total_debits'] ?? 0,
                ])
            ),
            'crm' => array_merge(
                $multi('deals_by_status', $data['deals_by_status'] ?? []),
                $multi('deals_by_seller', $data['deals_by_seller'] ?? []),
                $multi('health_distribution', $data['health_distribution'] ?? []),
                $single('summary', [
                    'total_deals' => $data['total_deals'] ?? 0,
                    'won_deals' => $data['won_deals'] ?? 0,
                    'conversion_rate' => $data['conversion_rate'] ?? 0,
                    'revenue' => $data['revenue'] ?? 0,
                    'avg_deal_value' => $data['avg_deal_value'] ?? 0,
                ])
            ),
            'equipments' => array_merge(
                $multi('by_class', $data['by_class'] ?? []),
                $multi('top_brands', $data['top_brands'] ?? []),
                $multi('due_alerts', $data['due_alerts'] ?? []),
                $multi('calibrations_period', $data['calibrations_period'] ?? []),
                $single('summary', [
                    'total_active' => $data['total_active'] ?? 0,
                    'total_inactive' => $data['total_inactive'] ?? 0,
                    'overdue_calibrations' => $data['overdue_calibrations'] ?? 0,
                    'total_calibration_cost' => $data['total_calibration_cost'] ?? 0,
                ])
            ),
            'suppliers' => array_merge(
                $multi('ranking', $data['ranking'] ?? []),
                $multi('by_category', $data['by_category'] ?? []),
                $single('summary', [
                    'total_suppliers' => $data['total_suppliers'] ?? 0,
                    'active_suppliers' => $data['active_suppliers'] ?? 0,
                ])
            ),
            'stock' => array_merge(
                $single('summary', $data['summary'] ?? []),
                $multi('products', $data['products'] ?? []),
                $multi('recent_movements', $data['recent_movements'] ?? [])
            ),
            'customers' => array_merge(
                $multi('top_by_revenue', $data['top_by_revenue'] ?? []),
                $multi('by_segment', $data['by_segment'] ?? []),
                $single('summary', [
                    'total_active' => $data['total_active'] ?? 0,
                    'new_in_period' => $data['new_in_period'] ?? 0,
                ])
            ),
            default => $multi('rows', $data['rows'] ?? ($data['data'] ?? [])),
        };
    }

    private function toCsv(array $rows): string
    {
        $normalizedRows = array_map(static function ($row) {
            $normalized = [];
            foreach ((array) $row as $key => $value) {
                if (is_array($value) || is_object($value)) {
                    $normalized[$key] = json_encode($value, JSON_UNESCAPED_UNICODE);
                    continue;
                }
                $normalized[$key] = $value;
            }
            return $normalized;
        }, $rows);

        $headers = [];
        foreach ($normalizedRows as $row) {
            foreach (array_keys($row) as $key) {
                if (!in_array($key, $headers, true)) {
                    $headers[] = $key;
                }
            }
        }

        $handle = fopen('php://temp', 'w+');
        fwrite($handle, "\xEF\xBB\xBF");
        fputcsv($handle, $headers, ';');
        foreach ($normalizedRows as $row) {
            $line = [];
            foreach ($headers as $header) {
                $line[] = $row[$header] ?? '';
            }
            fputcsv($handle, $line, ';');
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return (string) $csv;
    }
}
