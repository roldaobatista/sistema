<?php

namespace App\Services;

class ViaCepService extends ExternalApiService
{
    private const BASE_URL = 'https://viacep.com.br/ws';
    private const CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

    public function lookup(string $cep): ?array
    {
        $cep = preg_replace('/\D/', '', $cep);

        if (strlen($cep) !== 8) {
            return null;
        }

        $data = $this->fetch(
            self::BASE_URL . "/{$cep}/json/",
            "viacep:{$cep}",
            self::CACHE_TTL
        );

        if (!$data || isset($data['erro'])) {
            return null;
        }

        return [
            'cep' => $data['cep'] ?? null,
            'street' => $data['logradouro'] ?? null,
            'complement' => $data['complemento'] ?? null,
            'neighborhood' => $data['bairro'] ?? null,
            'city' => $data['localidade'] ?? null,
            'state' => $data['uf'] ?? null,
            'ibge_code' => $data['ibge'] ?? null,
        ];
    }
}
