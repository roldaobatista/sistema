<?php

namespace App\Services;

class BrasilApiService extends ExternalApiService
{
    private const BASE_URL = 'https://brasilapi.com.br/api';

    public function cnpj(string $cnpj): ?array
    {
        $cnpj = preg_replace('/\D/', '', $cnpj);

        if (strlen($cnpj) !== 14) {
            return null;
        }

        $data = $this->fetch(
            self::BASE_URL . "/cnpj/v1/{$cnpj}",
            "cnpj:{$cnpj}",
            60 * 60 * 24 * 7 // 7 days
        );

        if (!$data || isset($data['message'])) {
            return null;
        }

        return [
            'cnpj' => $data['cnpj'] ?? null,
            'name' => $data['razao_social'] ?? null,
            'trade_name' => $data['nome_fantasia'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['ddd_telefone_1'] ?? null,
            'address_zip' => $data['cep'] ?? null,
            'address_street' => trim(($data['descricao_tipo_de_logradouro'] ?? '') . ' ' . ($data['logradouro'] ?? '')),
            'address_number' => $data['numero'] ?? null,
            'address_complement' => $data['complemento'] ?? null,
            'address_neighborhood' => $data['bairro'] ?? null,
            'address_city' => $data['municipio'] ?? null,
            'address_state' => $data['uf'] ?? null,
            'status' => $data['descricao_situacao_cadastral'] ?? null,
            'main_activity' => $data['cnae_fiscal_descricao'] ?? null,
            'company_size' => $data['porte'] ?? null,
            'opened_at' => $data['data_inicio_atividade'] ?? null,
        ];
    }

    public function holidays(int $year): array
    {
        $data = $this->fetch(
            self::BASE_URL . "/feriados/v3/{$year}",
            "holidays:{$year}",
            60 * 60 * 24 * 365 // 1 year
        );

        return $data ?? [];
    }

    public function banks(): array
    {
        $data = $this->fetch(
            self::BASE_URL . '/banks/v1',
            'banks:all',
            60 * 60 * 24 * 30 // 30 days
        );

        return $data ?? [];
    }

    public function ddd(string $ddd): ?array
    {
        $ddd = preg_replace('/\D/', '', $ddd);

        if (strlen($ddd) < 2 || strlen($ddd) > 3) {
            return null;
        }

        $data = $this->fetch(
            self::BASE_URL . "/ddd/v1/{$ddd}",
            "ddd:{$ddd}",
            60 * 60 * 24 * 365 // 1 year
        );

        if (!$data || isset($data['message'])) {
            return null;
        }

        return [
            'state' => $data['state'] ?? null,
            'cities' => $data['cities'] ?? [],
        ];
    }
}
