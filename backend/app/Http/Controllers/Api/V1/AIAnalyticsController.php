<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AIAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AIAnalyticsController extends Controller
{
    public function __construct(private AIAnalyticsService $service)
    {
    }

    public function predictiveMaintenance(Request $request): JsonResponse
    {
        $data = $this->service->predictiveMaintenance(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function expenseOcrAnalysis(Request $request): JsonResponse
    {
        $data = $this->service->expenseOcrAnalysis(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function triageSuggestions(Request $request): JsonResponse
    {
        $data = $this->service->triageSuggestions(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function sentimentAnalysis(Request $request): JsonResponse
    {
        $data = $this->service->sentimentAnalysis(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function dynamicPricing(Request $request): JsonResponse
    {
        $data = $this->service->dynamicPricing(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function financialAnomalies(Request $request): JsonResponse
    {
        $data = $this->service->financialAnomalies(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function voiceCommandSuggestions(Request $request): JsonResponse
    {
        $data = $this->service->voiceCommandSuggestions(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function naturalLanguageReport(Request $request): JsonResponse
    {
        $data = $this->service->naturalLanguageReport(
            $request->user()->tenant_id,
            $request->only(['period'])
        );

        return response()->json($data);
    }

    public function customerClustering(Request $request): JsonResponse
    {
        $data = $this->service->customerClustering(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function equipmentImageAnalysis(Request $request): JsonResponse
    {
        $data = $this->service->equipmentImageAnalysis(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function demandForecast(Request $request): JsonResponse
    {
        $data = $this->service->demandForecast(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function aiRouteOptimization(Request $request): JsonResponse
    {
        $data = $this->service->aiRouteOptimization(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function smartTicketLabeling(Request $request): JsonResponse
    {
        $data = $this->service->smartTicketLabeling(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function churnPrediction(Request $request): JsonResponse
    {
        $data = $this->service->churnPrediction(
            $request->user()->tenant_id,
            $request->only(['limit'])
        );

        return response()->json($data);
    }

    public function serviceSummary(Request $request, int $workOrderId): JsonResponse
    {
        $data = $this->service->serviceSummary(
            $request->user()->tenant_id,
            $workOrderId
        );

        return response()->json($data);
    }
}
