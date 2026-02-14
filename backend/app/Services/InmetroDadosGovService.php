<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * Service to fetch supplementary data from dados.gov.br (Brazilian open data portal).
 * Provides additional instrument and enterprise data to enrich INMETRO intelligence.
 */
class InmetroDadosGovService
{
    private const BASE_URL = 'https://dados.gov.br/dados/api/publico';
    private const CACHE_TTL = 86400; // 24 hours
    private const DATASET_INMETRO = 'instrumentos-de-medicao';

    /**
     * Fetch INMETRO instrument data from dados.gov.br for a given UF.
     *
     * @return array{success: bool, data: array, source: string, cached: bool}
     */
    public function fetchInstrumentData(string $uf, string $type = 'balanca'): array
    {
        $cacheKey = "dadosgov:instruments:{$uf}:{$type}";

        if ($cached = Cache::get($cacheKey)) {
            return ['success' => true, 'data' => $cached, 'source' => 'dados.gov.br', 'cached' => true];
        }

        try {
            $response = Http::timeout(30)
                ->retry(2, 1000)
                ->get(self::BASE_URL . '/conjuntos-dados', [
                    'isPrivado' => false,
                    'nomeConjuntoDados' => self::DATASET_INMETRO,
                    'pagina' => 1,
                    'tamanhoPagina' => 100,
                ]);

            if (!$response->successful()) {
                Log::warning('DadosGov API returned non-200', [
                    'status' => $response->status(),
                    'uf' => $uf,
                ]);
                return ['success' => false, 'data' => [], 'source' => 'dados.gov.br', 'cached' => false];
            }

            $data = $response->json();
            $datasets = $data['registros'] ?? [];

            // Filter and extract relevant resources
            $resources = [];
            foreach ($datasets as $dataset) {
                $recursos = $dataset['recursos'] ?? [];
                foreach ($recursos as $recurso) {
                    if (stripos($recurso['titulo'] ?? '', $uf) !== false ||
                        stripos($recurso['descricao'] ?? '', $type) !== false) {
                        $resources[] = [
                            'id' => $recurso['id'] ?? null,
                            'title' => $recurso['titulo'] ?? '',
                            'description' => $recurso['descricao'] ?? '',
                            'url' => $recurso['link'] ?? '',
                            'format' => $recurso['formato'] ?? '',
                            'updated_at' => $recurso['dataUltimaAtualizacao'] ?? null,
                        ];
                    }
                }
            }

            Cache::put($cacheKey, $resources, self::CACHE_TTL);

            return ['success' => true, 'data' => $resources, 'source' => 'dados.gov.br', 'cached' => false];
        } catch (\Exception $e) {
            Log::error('DadosGov API error', [
                'error' => $e->getMessage(),
                'uf' => $uf,
                'type' => $type,
            ]);
            return ['success' => false, 'data' => [], 'source' => 'dados.gov.br', 'cached' => false];
        }
    }

    /**
     * Fetch enterprise/company data from Receita Federal open data (via dados.gov.br).
     * Used to enrich INMETRO owner data with CNAE, legal nature, etc.
     */
    public function fetchEnterpriseData(string $cnpj): array
    {
        $cleanCnpj = preg_replace('/\D/', '', $cnpj);
        if (strlen($cleanCnpj) !== 14) {
            return ['success' => false, 'data' => [], 'error' => 'Invalid CNPJ'];
        }

        $cacheKey = "dadosgov:enterprise:{$cleanCnpj}";
        if ($cached = Cache::get($cacheKey)) {
            return ['success' => true, 'data' => $cached, 'source' => 'dados.gov.br', 'cached' => true];
        }

        try {
            // Try BrasilAPI as a proxy for Receita Federal data
            $response = Http::timeout(15)
                ->retry(2, 500)
                ->get("https://brasilapi.com.br/api/cnpj/v1/{$cleanCnpj}");

            if (!$response->successful()) {
                return ['success' => false, 'data' => [], 'source' => 'brasilapi', 'cached' => false];
            }

            $data = $response->json();
            $enrichment = [
                'razao_social' => $data['razao_social'] ?? null,
                'nome_fantasia' => $data['nome_fantasia'] ?? null,
                'cnae_fiscal' => $data['cnae_fiscal'] ?? null,
                'cnae_descricao' => $data['cnae_fiscal_descricao'] ?? null,
                'natureza_juridica' => $data['natureza_juridica'] ?? null,
                'porte' => $data['porte'] ?? null,
                'situacao_cadastral' => $data['descricao_situacao_cadastral'] ?? null,
                'capital_social' => $data['capital_social'] ?? null,
                'data_inicio_atividade' => $data['data_inicio_atividade'] ?? null,
                'logradouro' => $data['logradouro'] ?? null,
                'numero' => $data['numero'] ?? null,
                'complemento' => $data['complemento'] ?? null,
                'bairro' => $data['bairro'] ?? null,
                'municipio' => $data['municipio'] ?? null,
                'uf' => $data['uf'] ?? null,
                'cep' => $data['cep'] ?? null,
                'telefone' => $data['ddd_telefone_1'] ?? null,
                'email' => $data['email'] ?? null,
                'qsa' => collect($data['qsa'] ?? [])->map(fn($s) => [
                    'nome' => $s['nome_socio'] ?? '',
                    'qualificacao' => $s['qualificacao_socio'] ?? '',
                ])->toArray(),
            ];

            Cache::put($cacheKey, $enrichment, self::CACHE_TTL * 7); // 7 days for enterprise data

            return ['success' => true, 'data' => $enrichment, 'source' => 'brasilapi', 'cached' => false];
        } catch (\Exception $e) {
            Log::error('Enterprise data fetch error', [
                'cnpj' => $cleanCnpj,
                'error' => $e->getMessage(),
            ]);
            return ['success' => false, 'data' => [], 'source' => 'brasilapi', 'cached' => false];
        }
    }

    /**
     * Fetch available INMETRO datasets summary.
     */
    public function getAvailableDatasets(): array
    {
        $cacheKey = 'dadosgov:datasets:inmetro';
        if ($cached = Cache::get($cacheKey)) {
            return $cached;
        }

        try {
            $response = Http::timeout(20)
                ->get(self::BASE_URL . '/conjuntos-dados', [
                    'isPrivado' => false,
                    'organizacaoId' => '', // INMETRO org
                    'pagina' => 1,
                    'tamanhoPagina' => 50,
                ]);

            if (!$response->successful()) {
                return [];
            }

            $datasets = collect($response->json()['registros'] ?? [])
                ->filter(fn($d) =>
                    stripos($d['titulo'] ?? '', 'inmetro') !== false ||
                    stripos($d['titulo'] ?? '', 'metrolog') !== false ||
                    stripos($d['titulo'] ?? '', 'instrumento') !== false ||
                    stripos($d['titulo'] ?? '', 'balança') !== false
                )
                ->map(fn($d) => [
                    'id' => $d['id'] ?? null,
                    'title' => $d['titulo'] ?? '',
                    'description' => mb_substr($d['descricao'] ?? '', 0, 200),
                    'organization' => $d['organizacao']['nome'] ?? '',
                    'resources_count' => count($d['recursos'] ?? []),
                    'updated_at' => $d['dataUltimaAtualizacao'] ?? null,
                ])
                ->values()
                ->toArray();

            Cache::put($cacheKey, $datasets, self::CACHE_TTL);

            return $datasets;
        } catch (\Exception $e) {
            Log::error('DadosGov datasets fetch error', ['error' => $e->getMessage()]);
            return [];
        }
    }
}
