<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Fiscal\FiscalReportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FiscalReportController extends Controller
{
    public function __construct(private FiscalReportService $reportService) {}

    /**
     * #1 — SPED Fiscal report.
     */
    public function spedFiscal(Request $request): JsonResponse
    {
        $request->validate([
            'inicio' => 'required|date',
            'fim' => 'required|date|after_or_equal:inicio',
        ]);

        $result = $this->reportService->generateSpedFiscal(
            $request->user()->tenant,
            Carbon::parse($request->inicio),
            Carbon::parse($request->fim),
        );

        return response()->json($result);
    }

    /**
     * #2 — Tax dashboard.
     */
    public function taxDashboard(Request $request): JsonResponse
    {
        $periodo = $request->query('periodo', 'month');
        $result = $this->reportService->taxDashboard($request->user()->tenant, $periodo);
        return response()->json($result);
    }

    /**
     * #3 — Export ZIP for accountant.
     */
    public function exportAccountant(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $request->validate(['mes' => 'required|date_format:Y-m']);

        $result = $this->reportService->exportForAccountant(
            $request->user()->tenant,
            Carbon::parse($request->mes . '-01'),
        );

        if (! $result['success']) {
            return response()->json(['error' => $result['error']], 404);
        }

        return response()->download($result['full_path'], $result['file_name'])->deleteFileAfterSend(true);
    }

    /**
     * #4 — Ledger report.
     */
    public function ledger(Request $request): JsonResponse
    {
        $request->validate([
            'inicio' => 'required|date',
            'fim' => 'required|date|after_or_equal:inicio',
        ]);

        $result = $this->reportService->ledgerReport(
            $request->user()->tenant,
            Carbon::parse($request->inicio),
            Carbon::parse($request->fim),
        );

        return response()->json($result);
    }

    /**
     * #5 — Tax forecast.
     */
    public function taxForecast(Request $request): JsonResponse
    {
        $result = $this->reportService->taxForecast($request->user()->tenant);
        return response()->json($result);
    }
}
