<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\BrasilApiService;
use App\Services\IbgeService;
use App\Services\ViaCepService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ExternalApiController extends Controller
{
    public function __construct(
        private readonly ViaCepService $viaCep,
        private readonly BrasilApiService $brasilApi,
        private readonly IbgeService $ibge,
    ) {}

    public function cep(string $cep): JsonResponse
    {
        try {
            $data = $this->viaCep->lookup($cep);

            if (!$data) {
                return response()->json(['message' => 'CEP não encontrado'], 404);
            }

            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('ExternalApi cep failed', ['error' => $e->getMessage(), 'cep' => $cep]);
            return response()->json(['message' => 'Erro ao consultar CEP'], 500);
        }
    }

    public function cnpj(string $cnpj): JsonResponse
    {
        try {
            $data = $this->brasilApi->cnpj($cnpj);

            if (!$data) {
                return response()->json(['message' => 'CNPJ não encontrado'], 404);
            }

            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('ExternalApi cnpj failed', ['error' => $e->getMessage(), 'cnpj' => $cnpj]);
            return response()->json(['message' => 'Erro ao consultar CNPJ'], 500);
        }
    }

    public function holidays(int $year): JsonResponse
    {
        try {
            $data = $this->brasilApi->holidays($year);
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('ExternalApi holidays failed', ['error' => $e->getMessage(), 'year' => $year]);
            return response()->json(['message' => 'Erro ao consultar feriados'], 500);
        }
    }

    public function banks(): JsonResponse
    {
        try {
            $data = $this->brasilApi->banks();
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('ExternalApi banks failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao consultar bancos'], 500);
        }
    }

    public function ddd(string $ddd): JsonResponse
    {
        try {
            $data = $this->brasilApi->ddd($ddd);

            if (!$data) {
                return response()->json(['message' => 'DDD não encontrado'], 404);
            }

            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('ExternalApi ddd failed', ['error' => $e->getMessage(), 'ddd' => $ddd]);
            return response()->json(['message' => 'Erro ao consultar DDD'], 500);
        }
    }

    public function states(): JsonResponse
    {
        try {
            $data = $this->ibge->states();
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('ExternalApi states failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao consultar estados'], 500);
        }
    }

    public function cities(string $uf): JsonResponse
    {
        try {
            $data = $this->ibge->cities($uf);
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('ExternalApi cities failed', ['error' => $e->getMessage(), 'uf' => $uf]);
            return response()->json(['message' => 'Erro ao consultar cidades'], 500);
        }
    }
}
