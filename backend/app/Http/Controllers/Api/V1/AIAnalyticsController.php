<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Services\AIAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AIAnalyticsController extends Controller
{
    use ResolvesCurrentTenant;
    public function __construct(private AIAnalyticsService $service)
    {
    }

    public function predictiveMaintenance(Request $request): JsonResponse
    {
        try {
            $data = $this->service->predictiveMaintenance(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI predictiveMaintenance failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na análise preditiva de manutenção'], 500);
        }
    }

    public function expenseOcrAnalysis(Request $request): JsonResponse
    {
        try {
            $data = $this->service->expenseOcrAnalysis(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI expenseOcrAnalysis failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na análise OCR de despesas'], 500);
        }
    }

    public function triageSuggestions(Request $request): JsonResponse
    {
        try {
            $data = $this->service->triageSuggestions(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI triageSuggestions failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro nas sugestões de triagem'], 500);
        }
    }

    public function sentimentAnalysis(Request $request): JsonResponse
    {
        try {
            $data = $this->service->sentimentAnalysis(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI sentimentAnalysis failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na análise de sentimento'], 500);
        }
    }

    public function dynamicPricing(Request $request): JsonResponse
    {
        try {
            $data = $this->service->dynamicPricing(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI dynamicPricing failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na precificação dinâmica'], 500);
        }
    }

    public function financialAnomalies(Request $request): JsonResponse
    {
        try {
            $data = $this->service->financialAnomalies(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI financialAnomalies failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na detecção de anomalias financeiras'], 500);
        }
    }

    public function voiceCommandSuggestions(Request $request): JsonResponse
    {
        try {
            $data = $this->service->voiceCommandSuggestions(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI voiceCommandSuggestions failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro nas sugestões de comando de voz'], 500);
        }
    }

    public function naturalLanguageReport(Request $request): JsonResponse
    {
        try {
            $data = $this->service->naturalLanguageReport(
                $this->resolvedTenantId(),
                $request->only(['period'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI naturalLanguageReport failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro no relatório em linguagem natural'], 500);
        }
    }

    public function customerClustering(Request $request): JsonResponse
    {
        try {
            $data = $this->service->customerClustering(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI customerClustering failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro no clustering de clientes'], 500);
        }
    }

    public function equipmentImageAnalysis(Request $request): JsonResponse
    {
        try {
            $data = $this->service->equipmentImageAnalysis(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI equipmentImageAnalysis failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na análise de imagem de equipamento'], 500);
        }
    }

    public function demandForecast(Request $request): JsonResponse
    {
        try {
            $data = $this->service->demandForecast(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI demandForecast failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na previsão de demanda'], 500);
        }
    }

    public function aiRouteOptimization(Request $request): JsonResponse
    {
        try {
            $data = $this->service->aiRouteOptimization(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI aiRouteOptimization failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na otimização de rotas'], 500);
        }
    }

    public function smartTicketLabeling(Request $request): JsonResponse
    {
        try {
            $data = $this->service->smartTicketLabeling(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI smartTicketLabeling failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na rotulação inteligente de chamados'], 500);
        }
    }

    public function churnPrediction(Request $request): JsonResponse
    {
        try {
            $data = $this->service->churnPrediction(
                $this->resolvedTenantId(),
                $request->only(['limit'])
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI churnPrediction failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na predição de churn'], 500);
        }
    }

    public function serviceSummary(Request $request, int $workOrderId): JsonResponse
    {
        try {
            $data = $this->service->serviceSummary(
                $this->resolvedTenantId(),
                $workOrderId
            );
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('AI serviceSummary failed', ['error' => $e->getMessage(), 'workOrderId' => $workOrderId]);
            return response()->json(['message' => 'Erro no resumo de serviço'], 500);
        }
    }
}
