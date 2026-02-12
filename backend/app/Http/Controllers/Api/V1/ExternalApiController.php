<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\BrasilApiService;
use App\Services\IbgeService;
use App\Services\ViaCepService;
use Illuminate\Http\JsonResponse;

class ExternalApiController extends Controller
{
    public function __construct(
        private readonly ViaCepService $viaCep,
        private readonly BrasilApiService $brasilApi,
        private readonly IbgeService $ibge,
    ) {}

    public function cep(string $cep): JsonResponse
    {
        $data = $this->viaCep->lookup($cep);

        if (!$data) {
            return response()->json(['message' => 'CEP não encontrado'], 404);
        }

        return response()->json($data);
    }

    public function cnpj(string $cnpj): JsonResponse
    {
        $data = $this->brasilApi->cnpj($cnpj);

        if (!$data) {
            return response()->json(['message' => 'CNPJ não encontrado'], 404);
        }

        return response()->json($data);
    }

    public function holidays(int $year): JsonResponse
    {
        $data = $this->brasilApi->holidays($year);

        return response()->json($data);
    }

    public function banks(): JsonResponse
    {
        $data = $this->brasilApi->banks();

        return response()->json($data);
    }

    public function ddd(string $ddd): JsonResponse
    {
        $data = $this->brasilApi->ddd($ddd);

        if (!$data) {
            return response()->json(['message' => 'DDD não encontrado'], 404);
        }

        return response()->json($data);
    }

    public function states(): JsonResponse
    {
        $data = $this->ibge->states();

        return response()->json($data);
    }

    public function cities(string $uf): JsonResponse
    {
        $data = $this->ibge->cities($uf);

        return response()->json($data);
    }
}
