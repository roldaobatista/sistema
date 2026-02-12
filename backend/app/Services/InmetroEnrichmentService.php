<?php

namespace App\Services;

use App\Models\InmetroOwner;
use App\Models\InmetroLocation;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class InmetroEnrichmentService
{
    /**
     * Enrich owner contact data from multiple sources.
     */
    public function enrichOwner(InmetroOwner $owner): array
    {
        $enriched = ['source' => [], 'data' => []];

        $document = $owner->document;
        if (str_starts_with($document, 'SEM-DOC')) {
            return ['success' => false, 'error' => 'No document available for enrichment'];
        }

        $isCnpj = strlen(preg_replace('/\D/', '', $document)) === 14;

        if ($isCnpj) {
            $result = $this->enrichFromBrasilApi($document);
            if ($result) {
                $enriched = $this->mergeEnrichment($enriched, $result, 'brasilapi');
            }

            if (empty($enriched['data']['phone'])) {
                $result = $this->enrichFromReceitaWs($document);
                if ($result) {
                    $enriched = $this->mergeEnrichment($enriched, $result, 'receitaws');
                }
            }
        } else {
            $result = $this->enrichFromSintegraMt($document);
            if ($result) {
                $enriched = $this->mergeEnrichment($enriched, $result, 'sintegra_mt');
            }
        }

        if (!empty($enriched['data'])) {
            $updateData = array_filter([
                'name' => $enriched['data']['name'] ?? null,
                'phone' => $enriched['data']['phone'] ?? null,
                'phone2' => $enriched['data']['phone2'] ?? null,
                'email' => $enriched['data']['email'] ?? null,
                'trade_name' => $enriched['data']['trade_name'] ?? null,
                'contact_source' => implode(',', $enriched['source']),
                'contact_enriched_at' => now(),
            ]);

            $owner->update($updateData);

            if (!empty($enriched['data']['locations'])) {
                foreach ($enriched['data']['locations'] as $locData) {
                    $city = $locData['city'] ?? '';
                    if (empty($city)) continue;

                    $existing = $owner->locations()->where('address_city', $city)->first();
                    if ($existing) {
                        $existing->update(array_filter([
                            'address_street' => $locData['street'] ?? null,
                            'address_number' => $locData['number'] ?? null,
                            'address_complement' => $locData['complement'] ?? null,
                            'address_neighborhood' => $locData['neighborhood'] ?? null,
                            'address_zip' => $locData['zip'] ?? null,
                            'state_registration' => $locData['ie'] ?? null,
                            'phone_local' => $locData['phone'] ?? null,
                            'email_local' => $locData['email'] ?? null,
                        ]));
                    }
                }
            }

            return ['success' => true, 'enriched' => $enriched];
        }

        return ['success' => false, 'error' => 'No data found from any source'];
    }

    /**
     * Batch enrich multiple owners.
     */
    public function enrichBatch(array $ownerIds, int $tenantId): array
    {
        $stats = ['enriched' => 0, 'failed' => 0, 'skipped' => 0];

        $owners = InmetroOwner::where('tenant_id', $tenantId)
            ->whereIn('id', $ownerIds)
            ->whereNull('contact_enriched_at')
            ->get();

        foreach ($owners as $owner) {
            if (str_starts_with($owner->document, 'SEM-DOC')) {
                $stats['skipped']++;
                continue;
            }

            $result = $this->enrichOwner($owner);
            if ($result['success']) {
                $stats['enriched']++;
            } else {
                $stats['failed']++;
            }

            usleep(500000); // 500ms rate limit between requests
        }

        return $stats;
    }

    /**
     * BrasilAPI: CNPJ → company data, phone, email.
     */
    private function enrichFromBrasilApi(string $cnpj): ?array
    {
        $cleanCnpj = preg_replace('/\D/', '', $cnpj);
        $cacheKey = "brasilapi_cnpj_{$cleanCnpj}";

        return Cache::remember($cacheKey, 86400 * 7, function () use ($cleanCnpj) {
            try {
                $response = Http::timeout(10)->get("https://brasilapi.com.br/api/cnpj/v1/{$cleanCnpj}");
                if (!$response->successful()) return null;

                $data = $response->json();
                return [
                    'name' => $data['razao_social'] ?? null,
                    'trade_name' => $data['nome_fantasia'] ?? null,
                    'phone' => $data['ddd_telefone_1'] ?? null,
                    'phone2' => $data['ddd_telefone_2'] ?? null,
                    'email' => $data['email'] ?? null,
                    'locations' => [
                        [
                            'street' => ($data['descricao_tipo_de_logradouro'] ?? '') . ' ' . ($data['logradouro'] ?? ''),
                            'number' => $data['numero'] ?? null,
                            'complement' => $data['complemento'] ?? null,
                            'neighborhood' => $data['bairro'] ?? null,
                            'city' => $data['municipio'] ?? null,
                            'zip' => $data['cep'] ?? null,
                        ],
                    ],
                ];
            } catch (\Exception $e) {
                Log::warning('BrasilAPI enrichment failed', ['cnpj' => $cleanCnpj, 'error' => $e->getMessage()]);
                return null;
            }
        });
    }

    /**
     * ReceitaWS: CNPJ → company data (fallback).
     */
    private function enrichFromReceitaWs(string $cnpj): ?array
    {
        $cleanCnpj = preg_replace('/\D/', '', $cnpj);
        $cacheKey = "receitaws_cnpj_{$cleanCnpj}";

        return Cache::remember($cacheKey, 86400 * 7, function () use ($cleanCnpj) {
            try {
                $response = Http::timeout(10)->get("https://receitaws.com.br/v1/cnpj/{$cleanCnpj}");
                if (!$response->successful()) return null;

                $data = $response->json();
                if (($data['status'] ?? '') === 'ERROR') return null;

                return [
                    'name' => $data['nome'] ?? null,
                    'trade_name' => $data['fantasia'] ?? null,
                    'phone' => $data['telefone'] ?? null,
                    'email' => $data['email'] ?? null,
                    'locations' => [
                        [
                            'street' => $data['logradouro'] ?? null,
                            'number' => $data['numero'] ?? null,
                            'complement' => $data['complemento'] ?? null,
                            'neighborhood' => $data['bairro'] ?? null,
                            'city' => $data['municipio'] ?? null,
                            'zip' => $data['cep'] ?? null,
                        ],
                    ],
                ];
            } catch (\Exception $e) {
                Log::warning('ReceitaWS enrichment failed', ['cnpj' => $cleanCnpj, 'error' => $e->getMessage()]);
                return null;
            }
        });
    }

    /**
     * Sintegra MT: CPF → Inscrição Estadual (for rural producers).
     */
    private function enrichFromSintegraMt(string $cpf): ?array
    {
        $cleanCpf = preg_replace('/\D/', '', $cpf);
        
        // BrasilAPI does not support CPF enrichment. 
        // We log and return null to prevent errors.
        Log::info('CPF enrichment skipped (No free provider for CPF)', ['cpf' => $cleanCpf]);
        return null;
    }

    private function mergeEnrichment(array $existing, array $new, string $source): array
    {
        $existing['source'][] = $source;
        foreach ($new as $key => $value) {
            if ($key === 'locations') {
                $existing['data']['locations'] = array_merge($existing['data']['locations'] ?? [], $value);
            } elseif (!empty($value) && empty($existing['data'][$key])) {
                $existing['data'][$key] = $value;
            }
        }
        return $existing;
    }
}
