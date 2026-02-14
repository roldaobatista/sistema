<?php

namespace App\Services;

use App\Models\InmetroOwner;
use App\Models\InmetroLocation;
use App\Models\InmetroInstrument;
use App\Models\InmetroHistory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class InmetroPsieScraperService
{
    private const PSIE_BASE = 'https://servicos.rbmlq.gov.br';

    /**
     * Get the captcha page URL and session ID for manual resolution.
     * The user must visit this URL, solve the captcha, and return the cookies.
     */
    public function initCaptchaSession(string $section = 'Instrumento'): array
    {
        $sessionId = uniqid('psie_', true);

        Cache::put("inmetro_captcha_{$sessionId}", [
            'status' => 'pending',
            'section' => $section,
            'started_at' => now()->toIso8601String(),
        ], 3600);

        return [
            'session_id' => $sessionId,
            'captcha_url' => self::PSIE_BASE . "/{$section}",
            'instructions' => 'Acesse a URL no navegador, resolva o captcha, e copie os cookies da sessão.',
        ];
    }

    /**
     * After the user has resolved the captcha and provided cookies,
     * search instruments by municipality.
     */
    public function searchByMunicipality(
        string $sessionId,
        string $municipality,
        string $uf = 'MT',
        string $instrumentType = '',
        array $cookies = []
    ): array {
        $session = Cache::get("inmetro_captcha_{$sessionId}");
        if (!$session) {
            return ['success' => false, 'error' => 'Session expired'];
        }

        try {
            $response = Http::timeout(30)
                ->withCookies($cookies, parse_url(self::PSIE_BASE, PHP_URL_HOST))
                ->asForm()
                ->post(self::PSIE_BASE . '/Instrumento/Consultar', [
                    'SelectedSiglaUf' => $uf,
                    'SelectedMunicipio' => $municipality,
                    'SelectedTipoClassificacaoInstrumento' => $instrumentType,
                ]);

            if (!$response->successful()) {
                return ['success' => false, 'error' => "HTTP {$response->status()}"];
            }

            $html = $response->body();

            if (str_contains($html, 'g-recaptcha') || str_contains($html, 'recaptcha')) {
                Cache::put("inmetro_captcha_{$sessionId}", array_merge($session, ['status' => 'captcha_required']), 3600);
                return ['success' => false, 'error' => 'Captcha required', 'needs_captcha' => true];
            }

            $results = $this->parseInstrumentResults($html);

            Cache::put("inmetro_captcha_{$sessionId}", array_merge($session, [
                'status' => 'completed',
                'results_count' => count($results),
                'municipality' => $municipality,
            ]), 3600);

            return ['success' => true, 'data' => $results, 'count' => count($results)];
        } catch (\Exception $e) {
            Log::error('PSIE scraper error', ['error' => $e->getMessage(), 'municipality' => $municipality]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Parse HTML table results from the PSIE portal.
     */
    private function parseInstrumentResults(string $html): array
    {
        $results = [];

        if (!preg_match_all('/<tr[^>]*>(.*?)<\/tr>/s', $html, $rows)) {
            return $results;
        }

        $headers = [];
        foreach ($rows[1] as $index => $row) {
            preg_match_all('/<t[hd][^>]*>(.*?)<\/t[hd]>/s', $row, $cells);
            if (empty($cells[1])) continue;

            $values = array_map(fn($c) => trim(strip_tags($c)), $cells[1]);

            if ($index === 0 && count($values) > 0) {
                $headers = $values;
                continue;
            }

            if (count($headers) > 0 && count($values) >= count($headers)) {
                $record = [];
                foreach ($headers as $i => $header) {
                    $key = $this->normalizeHeader($header);
                    $record[$key] = $values[$i] ?? '';
                }
                if (!empty($record)) {
                    $results[] = $record;
                }
            }
        }

        return $results;
    }

    /**
     * Normalize table header to a snake_case key.
     */
    private function normalizeHeader(string $header): string
    {
        $map = [
            'Número Inmetro' => 'inmetro_number',
            'Numero Inmetro' => 'inmetro_number',
            'Nº Inmetro' => 'inmetro_number',
            'Número de Série' => 'serial_number',
            'Série' => 'serial_number',
            'Marca' => 'brand',
            'Modelo' => 'model',
            'Capacidade' => 'capacity',
            'Proprietário' => 'owner_name',
            'Proprietario' => 'owner_name',
            'CPF/CNPJ' => 'document',
            'CPF' => 'document',
            'CNPJ' => 'document',
            'Município' => 'city',
            'Municipio' => 'city',
            'UF' => 'state',
            'Data Última Verificação' => 'last_verification',
            'Data Verificação' => 'last_verification',
            'Resultado' => 'result',
            'Último Resultado' => 'result',
            'Data Validade' => 'validity_date',
            'Tipo' => 'instrument_type',
            'Órgão Executor' => 'executor',
            'Orgao Executor' => 'executor',
            'Executor' => 'executor',
        ];

        return $map[$header] ?? strtolower(preg_replace('/[^a-zA-Z0-9]/', '_', $header));
    }

    /**
     * Save scraped results to database.
     */
    public function saveScrapeResults(int $tenantId, array $results, string $source = 'psie_scrape'): array
    {
        $stats = ['owners_created' => 0, 'instruments_created' => 0, 'history_added' => 0, 'errors' => 0];

        DB::beginTransaction();
        try {
            foreach ($results as $record) {
                $ownerName = $record['owner_name'] ?? '';
                $document = preg_replace('/\D/', '', $record['document'] ?? '');
                $city = $record['city'] ?? '';
                $inmetroNumber = $record['inmetro_number'] ?? '';

                if (empty($ownerName) || empty($inmetroNumber)) {
                    $stats['errors']++;
                    continue;
                }

                $isPF = strlen($document) === 11;

                $owner = null;
                if ($document) {
                    $owner = InmetroOwner::where('tenant_id', $tenantId)->where('document', $document)->first();
                }
                if (!$owner) {
                    $owner = InmetroOwner::where('tenant_id', $tenantId)->where('name', $ownerName)->first();
                }
                if (!$owner) {
                    $owner = InmetroOwner::create([
                        'tenant_id' => $tenantId,
                        'document' => $document ?: 'SEM-DOC-' . md5($ownerName . $city),
                        'name' => $ownerName,
                        'type' => $isPF ? 'PF' : 'PJ',
                    ]);
                    $stats['owners_created']++;
                } elseif ($document && $owner->document !== $document) {
                    $owner->update(['document' => $document]);
                }

                $location = $owner->locations()->where('address_city', $city)->first();
                if (!$location) {
                    $location = $owner->locations()->create([
                        'address_city' => $city,
                        'address_state' => $record['state'] ?? 'MT',
                    ]);
                }

                $lastVerification = $this->parseDateStr($record['last_verification'] ?? '');
                $validityDate = $this->parseDateStr($record['validity_date'] ?? '');
                $resultStr = strtolower($record['result'] ?? '');

                $status = match (true) {
                    str_contains($resultStr, 'aprov') => 'approved',
                    str_contains($resultStr, 'reprov') => 'rejected',
                    str_contains($resultStr, 'repar') => 'repaired',
                    default => 'unknown',
                };

                $nextVerification = $validityDate ?? ($lastVerification ? $lastVerification->copy()->addYear() : null);

                $instrument = InmetroInstrument::where('inmetro_number', $inmetroNumber)->first();

                if (!$instrument) {
                    $instrument = InmetroInstrument::create([
                        'location_id' => $location->id,
                        'inmetro_number' => $inmetroNumber,
                        'serial_number' => $record['serial_number'] ?? null,
                        'brand' => $record['brand'] ?? null,
                        'model' => $record['model'] ?? null,
                        'capacity' => $record['capacity'] ?? null,
                        'instrument_type' => $record['instrument_type'] ?? 'Balança',
                        'current_status' => $status,
                        'last_verification_at' => $lastVerification,
                        'next_verification_at' => $nextVerification,
                        'last_executor' => $record['executor'] ?? null,
                        'source' => $source,
                    ]);
                    $stats['instruments_created']++;
                } else {
                    $instrument->update([
                        'current_status' => $status,
                        'last_verification_at' => $lastVerification,
                        'next_verification_at' => $nextVerification,
                        'last_executor' => $record['executor'] ?? $instrument->last_executor,
                    ]);
                }

                if ($lastVerification) {
                    $existingHistory = InmetroHistory::where('instrument_id', $instrument->id)
                        ->where('event_date', $lastVerification)
                        ->first();

                    if (!$existingHistory) {
                        $eventType = match ($status) {
                            'rejected' => 'rejection',
                            'repaired' => 'repair',
                            default => 'verification',
                        };

                        InmetroHistory::create([
                            'instrument_id' => $instrument->id,
                            'event_type' => $eventType,
                            'event_date' => $lastVerification,
                            'result' => $status,
                            'executor' => $record['executor'] ?? null,
                            'validity_date' => $validityDate,
                            'source' => $source,
                        ]);
                        $stats['history_added']++;
                    }
                }
            }

            DB::commit();
            return ['success' => true, 'stats' => $stats];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('PSIE save results failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage(), 'stats' => $stats];
        }
    }

    /**
     * Get the status of a captcha session.
     */
    public function getCaptchaStatus(string $sessionId): ?array
    {
        return Cache::get("inmetro_captcha_{$sessionId}");
    }

    /**
     * Get all municipalities in Mato Grosso from IBGE.
     */
    public function getMtMunicipalities(): array
    {
        return Cache::remember('ibge_mt_municipalities', 86400 * 30, function () {
            $response = Http::timeout(10)->get('https://servicodados.ibge.gov.br/api/v1/localidades/estados/51/municipios');
            if ($response->successful()) {
                return collect($response->json())->pluck('nome')->sort()->values()->toArray();
            }
            return [];
        });
    }

    private function parseDateStr(string $dateStr): ?Carbon
    {
        if (empty($dateStr)) return null;
        $formats = ['d/m/Y', 'Y-m-d', 'd-m-Y', 'Y-m-d\TH:i:s'];
        foreach ($formats as $format) {
            try {
                return Carbon::createFromFormat($format, trim($dateStr));
            } catch (\Exception) {
                continue;
            }
        }
        return null;
    }
}
