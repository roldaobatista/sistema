<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class BrasilApiService extends ExternalApiService
{
    private const BRASILAPI_URL = 'https://brasilapi.com.br/api';
    private const OPENCNPJ_URL = 'https://api.opencnpj.org';
    private const CNPJWS_URL   = 'https://publica.cnpj.ws/cnpj';

    /**
     * Consulta CNPJ com enriquecimento completo.
     * Tenta BrasilAPI primeiro, OpenCNPJ como fallback, CNPJ.ws como último recurso.
     */
    public function cnpj(string $cnpj): ?array
    {
        $cnpj = preg_replace('/\D/', '', $cnpj);

        if (strlen($cnpj) !== 14) {
            return null;
        }

        // Tenta BrasilAPI (principal)
        $data = $this->fetchFromBrasilApi($cnpj);

        // Fallback: OpenCNPJ
        if (!$data) {
            $data = $this->fetchFromOpenCnpj($cnpj);
        }

        // Último recurso: CNPJ.ws (limite de 3 req/min)
        if (!$data) {
            $data = $this->fetchFromCnpjWs($cnpj);
        }

        return $data;
    }

    private function fetchFromBrasilApi(string $cnpj): ?array
    {
        $raw = $this->fetch(
            self::BRASILAPI_URL . "/cnpj/v1/{$cnpj}",
            "cnpj:brasilapi:{$cnpj}",
            60 * 60 * 24 * 7
        );

        if (!$raw || isset($raw['message'])) {
            return null;
        }

        return $this->normalizeBrasilApi($raw);
    }

    private function fetchFromOpenCnpj(string $cnpj): ?array
    {
        $raw = $this->fetch(
            self::OPENCNPJ_URL . "/{$cnpj}",
            "cnpj:opencnpj:{$cnpj}",
            60 * 60 * 24 * 7
        );

        if (!$raw || isset($raw['error'])) {
            return null;
        }

        return $this->normalizeOpenCnpj($raw);
    }

    private function fetchFromCnpjWs(string $cnpj): ?array
    {
        $raw = $this->fetch(
            self::CNPJWS_URL . "/{$cnpj}",
            "cnpj:cnpjws:{$cnpj}",
            60 * 60 * 24 * 7
        );

        if (!$raw || isset($raw['status']) && $raw['status'] !== 200) {
            return null;
        }

        return $this->normalizeCnpjWs($raw);
    }

    private function normalizeBrasilApi(array $raw): array
    {
        $partners = [];
        foreach ($raw['qsa'] ?? [] as $p) {
            $partners[] = [
                'name'  => $p['nome_socio'] ?? null,
                'role'  => $p['qualificacao_socio'] ?? null,
                'document' => $p['cnpj_cpf_do_socio'] ?? null,
                'entry_date' => $p['data_entrada_sociedade'] ?? null,
                'share_percentage' => $p['percentual_capital_social'] ?? null,
            ];
        }

        $secondaryActivities = [];
        foreach ($raw['cnaes_secundarios'] ?? [] as $cnae) {
            if (!empty($cnae['codigo'])) {
                $secondaryActivities[] = [
                    'code' => (string) $cnae['codigo'],
                    'description' => $cnae['descricao'] ?? null,
                ];
            }
        }

        $street = trim(($raw['descricao_tipo_de_logradouro'] ?? '') . ' ' . ($raw['logradouro'] ?? ''));

        return [
            'source' => 'brasilapi',
            'cnpj' => $raw['cnpj'] ?? null,
            'name' => $raw['razao_social'] ?? null,
            'trade_name' => $raw['nome_fantasia'] ?? null,
            'email' => $raw['email'] ?? null,
            'phone' => $raw['ddd_telefone_1'] ?? null,
            'phone2' => $raw['ddd_telefone_2'] ?? null,
            'address_zip' => $raw['cep'] ?? null,
            'address_street' => $street ?: null,
            'address_number' => $raw['numero'] ?? null,
            'address_complement' => $raw['complemento'] ?? null,
            'address_neighborhood' => $raw['bairro'] ?? null,
            'address_city' => $raw['municipio'] ?? null,
            'address_state' => $raw['uf'] ?? null,
            // Dados enriquecidos
            'company_status' => $raw['descricao_situacao_cadastral'] ?? null,
            'company_status_date' => $raw['data_situacao_cadastral'] ?? null,
            'cnae_code' => $raw['cnae_fiscal'] ? (string) $raw['cnae_fiscal'] : null,
            'cnae_description' => $raw['cnae_fiscal_descricao'] ?? null,
            'legal_nature' => trim(($raw['codigo_natureza_juridica'] ?? '') . ' - ' . ($raw['natureza_juridica'] ?? ''), ' -'),
            'capital' => isset($raw['capital_social']) ? (float) $raw['capital_social'] : null,
            'company_size' => $raw['porte'] ?? $raw['descricao_porte'] ?? null,
            'opened_at' => $raw['data_inicio_atividade'] ?? null,
            'simples_nacional' => $raw['opcao_pelo_simples'] ?? null,
            'simples_desde' => $raw['data_opcao_pelo_simples'] ?? null,
            'mei' => $raw['opcao_pelo_mei'] ?? null,
            'partners' => $partners,
            'secondary_activities' => $secondaryActivities,
        ];
    }

    private function normalizeOpenCnpj(array $raw): array
    {
        $partners = [];
        foreach ($raw['socios'] ?? $raw['qsa'] ?? [] as $p) {
            $partners[] = [
                'name'  => $p['nome'] ?? $p['nome_socio'] ?? null,
                'role'  => $p['qualificacao'] ?? $p['qualificacao_socio'] ?? null,
                'document' => $p['cpf_cnpj'] ?? $p['cnpj_cpf_do_socio'] ?? null,
                'entry_date' => $p['data_entrada'] ?? $p['data_entrada_sociedade'] ?? null,
                'share_percentage' => null,
            ];
        }

        $secondaryActivities = [];
        foreach ($raw['atividades_secundarias'] ?? $raw['cnaes_secundarios'] ?? [] as $cnae) {
            $code = $cnae['id'] ?? $cnae['codigo'] ?? $cnae['code'] ?? null;
            if ($code) {
                $secondaryActivities[] = [
                    'code' => (string) $code,
                    'description' => $cnae['descricao'] ?? $cnae['text'] ?? null,
                ];
            }
        }

        $mainCnae = $raw['atividade_principal'] ?? $raw['estabelecimento']['atividade_principal'] ?? null;

        return [
            'source' => 'opencnpj',
            'cnpj' => $raw['cnpj'] ?? $raw['cnpj_raiz'] ?? null,
            'name' => $raw['razao_social'] ?? null,
            'trade_name' => $raw['nome_fantasia'] ?? $raw['estabelecimento']['nome_fantasia'] ?? null,
            'email' => $raw['email'] ?? $raw['estabelecimento']['email'] ?? null,
            'phone' => $raw['telefone1'] ?? $raw['ddd_telefone_1'] ?? null,
            'phone2' => $raw['telefone2'] ?? $raw['ddd_telefone_2'] ?? null,
            'address_zip' => $raw['cep'] ?? $raw['estabelecimento']['cep'] ?? null,
            'address_street' => $raw['logradouro'] ?? $raw['estabelecimento']['logradouro'] ?? null,
            'address_number' => $raw['numero'] ?? $raw['estabelecimento']['numero'] ?? null,
            'address_complement' => $raw['complemento'] ?? $raw['estabelecimento']['complemento'] ?? null,
            'address_neighborhood' => $raw['bairro'] ?? $raw['estabelecimento']['bairro'] ?? null,
            'address_city' => $raw['municipio'] ?? $raw['estabelecimento']['cidade']['nome'] ?? null,
            'address_state' => $raw['uf'] ?? $raw['estabelecimento']['estado']['sigla'] ?? null,
            'company_status' => $raw['situacao_cadastral'] ?? $raw['estabelecimento']['situacao_cadastral'] ?? null,
            'company_status_date' => $raw['data_situacao_cadastral'] ?? null,
            'cnae_code' => is_array($mainCnae) ? (string) ($mainCnae['id'] ?? $mainCnae['codigo'] ?? null) : ($raw['cnae_fiscal'] ? (string) $raw['cnae_fiscal'] : null),
            'cnae_description' => is_array($mainCnae) ? ($mainCnae['descricao'] ?? $mainCnae['text'] ?? null) : ($raw['cnae_fiscal_descricao'] ?? null),
            'legal_nature' => $raw['natureza_juridica'] ?? null,
            'capital' => isset($raw['capital_social']) ? (float) $raw['capital_social'] : null,
            'company_size' => $raw['porte'] ?? null,
            'opened_at' => $raw['data_inicio_atividade'] ?? $raw['estabelecimento']['data_inicio_atividade'] ?? null,
            'simples_nacional' => $raw['opcao_pelo_simples'] ?? $raw['simples']['simples'] ?? null,
            'simples_desde' => $raw['data_opcao_pelo_simples'] ?? $raw['simples']['data_opcao_simples'] ?? null,
            'mei' => $raw['opcao_pelo_mei'] ?? $raw['simples']['mei'] ?? null,
            'partners' => $partners,
            'secondary_activities' => $secondaryActivities,
        ];
    }

    private function normalizeCnpjWs(array $raw): array
    {
        $partners = [];
        foreach ($raw['socios'] ?? [] as $p) {
            $partners[] = [
                'name'  => $p['nome'] ?? null,
                'role'  => $p['qualificacao_socio']?->nome ?? ($p['qualificacao'] ?? null),
                'document' => $p['cpf_cnpj_socio'] ?? null,
                'entry_date' => $p['data_entrada_sociedade'] ?? null,
                'share_percentage' => null,
            ];
        }

        $secondaryActivities = [];
        $est = $raw['estabelecimento'] ?? [];
        foreach ($est['atividades_secundarias'] ?? [] as $cnae) {
            if (!empty($cnae['id'])) {
                $secondaryActivities[] = [
                    'code' => (string) $cnae['id'],
                    'description' => $cnae['descricao'] ?? null,
                ];
            }
        }

        $mainCnae = $est['atividade_principal'] ?? null;
        $cidade = $est['cidade'] ?? [];
        $estado = $est['estado'] ?? [];

        return [
            'source' => 'cnpjws',
            'cnpj' => $raw['cnpj_raiz'] ?? null,
            'name' => $raw['razao_social'] ?? null,
            'trade_name' => $est['nome_fantasia'] ?? null,
            'email' => $est['email'] ?? null,
            'phone' => !empty($est['ddd1']) ? ($est['ddd1'] . $est['telefone1']) : null,
            'phone2' => !empty($est['ddd2']) ? ($est['ddd2'] . $est['telefone2']) : null,
            'address_zip' => $est['cep'] ?? null,
            'address_street' => trim(($est['tipo_logradouro'] ?? '') . ' ' . ($est['logradouro'] ?? '')),
            'address_number' => $est['numero'] ?? null,
            'address_complement' => $est['complemento'] ?? null,
            'address_neighborhood' => $est['bairro'] ?? null,
            'address_city' => $cidade['nome'] ?? null,
            'address_state' => $estado['sigla'] ?? null,
            'company_status' => $est['situacao_cadastral'] ?? null,
            'company_status_date' => $est['data_situacao_cadastral'] ?? null,
            'cnae_code' => is_array($mainCnae) ? (string) ($mainCnae['id'] ?? null) : null,
            'cnae_description' => is_array($mainCnae) ? ($mainCnae['descricao'] ?? null) : null,
            'legal_nature' => isset($raw['natureza_juridica']) ? ($raw['natureza_juridica']['id'] . ' - ' . $raw['natureza_juridica']['descricao']) : null,
            'capital' => isset($raw['capital_social']) ? (float) str_replace(',', '.', $raw['capital_social']) : null,
            'company_size' => $raw['porte']['descricao'] ?? null,
            'opened_at' => $est['data_inicio_atividade'] ?? null,
            'simples_nacional' => $raw['simples']?->simples ?? ($raw['simples']['simples'] ?? null),
            'simples_desde' => $raw['simples']?->data_opcao_simples ?? ($raw['simples']['data_opcao_simples'] ?? null),
            'mei' => $raw['simples']?->mei ?? ($raw['simples']['mei'] ?? null),
            'partners' => $partners,
            'secondary_activities' => $secondaryActivities,
        ];
    }

    // ─── Métodos existentes ──────────────────────────────────────

    public function holidays(int $year): array
    {
        $data = $this->fetch(
            self::BRASILAPI_URL . "/feriados/v3/{$year}",
            "holidays:{$year}",
            60 * 60 * 24 * 365
        );

        return $data ?? [];
    }

    public function banks(): array
    {
        $data = $this->fetch(
            self::BRASILAPI_URL . '/banks/v1',
            'banks:all',
            60 * 60 * 24 * 30
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
            self::BRASILAPI_URL . "/ddd/v1/{$ddd}",
            "ddd:{$ddd}",
            60 * 60 * 24 * 365
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
