<?php

namespace App\Services;

class IbgeService extends ExternalApiService
{
    private const BASE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';
    private const CACHE_TTL = 60 * 60 * 24 * 365; // 1 year

    public function states(): array
    {
        $data = $this->fetch(
            self::BASE_URL . '/estados?orderBy=nome',
            'ibge:states',
            self::CACHE_TTL
        );

        if (!$data) {
            return [];
        }

        return collect($data)->map(fn(array $state) => [
            'id' => $state['id'],
            'abbr' => $state['sigla'],
            'name' => $state['nome'],
        ])->sortBy('name')->values()->all();
    }

    public function cities(string $uf): array
    {
        $uf = strtoupper(trim($uf));

        if (strlen($uf) !== 2) {
            return [];
        }

        $data = $this->fetch(
            self::BASE_URL . "/estados/{$uf}/municipios?orderBy=nome",
            "ibge:cities:{$uf}",
            self::CACHE_TTL
        );

        if (!$data) {
            return [];
        }

        return collect($data)->map(fn(array $city) => [
            'id' => $city['id'],
            'name' => $city['nome'],
        ])->sortBy('name')->values()->all();
    }
}
