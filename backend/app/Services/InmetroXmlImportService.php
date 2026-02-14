<?php

namespace App\Services;

use App\Models\InmetroOwner;
use App\Models\InmetroLocation;
use App\Models\InmetroInstrument;
use App\Models\InmetroHistory;
use App\Models\InmetroCompetitor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class InmetroXmlImportService
{
    private const BASE_URL = 'https://servicos.rbmlq.gov.br/dados-abertos';

    public const INSTRUMENT_TYPES = [
        'balanca-rodoferroviaria' => 'Balança Rodoferroviária',
        'balanca-dinamica'        => 'Balança Dinâmica',
        'balanca-comercial'       => 'Balança Comercial',
        'bomba-combustivel'       => 'Bomba de Combustível',
        'veiculotanque'           => 'Veículo Tanque',
        'cronotacografo'          => 'Cronotacógrafo',
        'taximetro'               => 'Taxímetro',
        'medidores'               => 'Medidor de Velocidade',
        'etilometro'              => 'Etilômetro',
        'esfigmomanometro'        => 'Esfigmomanômetro',
    ];

    public function importCompetitors(int $tenantId, string $uf = 'MT'): array
    {
        $url = self::BASE_URL . "/{$uf}/oficinas.xml";
        $stats = ['created' => 0, 'updated' => 0, 'errors' => 0];

        try {
            $response = Http::timeout(30)->get($url);
            if (!$response->successful()) {
                Log::error('INMETRO XML import failed', ['url' => $url, 'status' => $response->status()]);
                return ['success' => false, 'error' => "HTTP {$response->status()}", 'stats' => $stats];
            }

            $xml = simplexml_load_string($response->body());
            if (!$xml) {
                return ['success' => false, 'error' => 'Invalid XML', 'stats' => $stats];
            }

            DB::beginTransaction();

            foreach ($xml->children() as $oficina) {
                try {
                    $name = trim((string) ($oficina->RazaoSocial ?? $oficina->Nome ?? $oficina->razaoSocial ?? ''));
                    if (empty($name)) continue;

                    $cnpj = preg_replace('/\D/', '', (string) ($oficina->CNPJ ?? $oficina->Cnpj ?? $oficina->cnpj ?? ''));
                    $city = trim((string) ($oficina->Municipio ?? $oficina->Cidade ?? $oficina->municipio ?? ''));

                    $species = [];
                    if (isset($oficina->Especies)) {
                        foreach ($oficina->Especies->children() as $especie) {
                            $species[] = trim((string) $especie);
                        }
                    }
                    if (isset($oficina->EspeciesAutorizadas)) {
                        $species[] = trim((string) $oficina->EspeciesAutorizadas);
                    }

                    $mechanics = [];
                    if (isset($oficina->Mecanicos)) {
                        foreach ($oficina->Mecanicos->children() as $mecanico) {
                            $mechanics[] = trim((string) $mecanico);
                        }
                    }

                    $data = [
                        'tenant_id' => $tenantId,
                        'name' => $name,
                        'cnpj' => $cnpj ?: null,
                        'authorization_number' => trim((string) ($oficina->NumeroAutorizacao ?? $oficina->Autorizacao ?? '')),
                        'phone' => trim((string) ($oficina->Telefone ?? $oficina->telefone ?? '')),
                        'email' => trim((string) ($oficina->Email ?? $oficina->email ?? '')),
                        'address' => trim((string) ($oficina->Endereco ?? $oficina->endereco ?? '')),
                        'city' => $city,
                        'state' => $uf,
                        'authorized_species' => $species ?: null,
                        'mechanics' => $mechanics ?: null,
                    ];

                    $existing = InmetroCompetitor::where('tenant_id', $tenantId)
                        ->where('name', $name)
                        ->where('city', $city)
                        ->first();

                    if ($existing) {
                        $existing->update($data);
                        $stats['updated']++;
                    } else {
                        InmetroCompetitor::create($data);
                        $stats['created']++;
                    }
                } catch (\Exception $e) {
                    $stats['errors']++;
                    Log::warning('INMETRO competitor import error', ['error' => $e->getMessage()]);
                }
            }

            DB::commit();
            return ['success' => true, 'stats' => $stats];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('INMETRO competitor import failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage(), 'stats' => $stats];
        }
    }

    /**
     * Import all instrument types for a given UF.
     * Iterates through each type, accumulates stats, and handles failures per type.
     */
    public function importAllInstruments(int $tenantId, string $uf = 'MT', ?array $types = null): array
    {
        $typesToImport = $types ?? array_keys(self::INSTRUMENT_TYPES);
        $allStats = [
            'total_types_attempted' => 0,
            'total_types_success' => 0,
            'total_types_skipped' => 0,
            'owners_created' => 0,
            'owners_updated' => 0,
            'instruments_created' => 0,
            'instruments_updated' => 0,
            'history_added' => 0,
            'errors' => 0,
            'by_type' => [],
        ];

        foreach ($typesToImport as $type) {
            $allStats['total_types_attempted']++;
            $label = self::INSTRUMENT_TYPES[$type] ?? $type;

            try {
                $result = $this->importInstruments($tenantId, $uf, $type);

                $allStats['by_type'][$type] = [
                    'label' => $label,
                    'success' => $result['success'],
                    'stats' => $result['stats'] ?? [],
                    'error' => $result['error'] ?? null,
                ];

                if ($result['success']) {
                    $allStats['total_types_success']++;
                    $allStats['owners_created'] += $result['stats']['owners_created'] ?? 0;
                    $allStats['owners_updated'] += $result['stats']['owners_updated'] ?? 0;
                    $allStats['instruments_created'] += $result['stats']['instruments_created'] ?? 0;
                    $allStats['instruments_updated'] += $result['stats']['instruments_updated'] ?? 0;
                    $allStats['history_added'] += $result['stats']['history_added'] ?? 0;
                    $allStats['errors'] += $result['stats']['errors'] ?? 0;
                } else {
                    $allStats['total_types_skipped']++;
                    Log::info("INMETRO: Skipped type {$type} for {$uf}", ['error' => $result['error'] ?? 'unknown']);
                }
            } catch (\Exception $e) {
                $allStats['total_types_skipped']++;
                $allStats['by_type'][$type] = [
                    'label' => $label,
                    'success' => false,
                    'error' => $e->getMessage(),
                ];
                Log::warning("INMETRO: Exception importing type {$type}", ['error' => $e->getMessage()]);
            }
        }

        return ['success' => true, 'stats' => $allStats];
    }

    /**
     * All 27 Brazilian UFs available for import.
     */
    public const BRAZILIAN_UFS = [
        'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
        'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
        'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
    ];

    /**
     * Default INMETRO config for new tenants.
     */
    public static function defaultConfig(): array
    {
        return [
            'monitored_ufs' => ['MT'],
            'instrument_types' => array_keys(self::INSTRUMENT_TYPES),
            'auto_sync_enabled' => true,
            'sync_interval_days' => 7,
        ];
    }

    /**
     * Import instruments for multiple UFs based on tenant config.
     * Iterates UF × type, accumulates stats per UF.
     */
    public function importAllForConfig(int $tenantId, array $ufs, ?array $types = null): array
    {
        $results = [
            'total_ufs' => count($ufs),
            'by_uf' => [],
            'grand_totals' => [
                'owners_created' => 0,
                'owners_updated' => 0,
                'instruments_created' => 0,
                'instruments_updated' => 0,
                'history_added' => 0,
                'errors' => 0,
            ],
        ];

        foreach ($ufs as $uf) {
            $ufResult = $this->importAllInstruments($tenantId, $uf, $types);
            $results['by_uf'][$uf] = $ufResult;

            if ($ufResult['success']) {
                $stats = $ufResult['stats'];
                $results['grand_totals']['owners_created'] += $stats['owners_created'] ?? 0;
                $results['grand_totals']['owners_updated'] += $stats['owners_updated'] ?? 0;
                $results['grand_totals']['instruments_created'] += $stats['instruments_created'] ?? 0;
                $results['grand_totals']['instruments_updated'] += $stats['instruments_updated'] ?? 0;
                $results['grand_totals']['history_added'] += $stats['history_added'] ?? 0;
                $results['grand_totals']['errors'] += $stats['errors'] ?? 0;
            }
        }

        return ['success' => true, 'results' => $results];
    }

    public function importInstruments(int $tenantId, string $uf = 'MT', string $type = 'balanca-rodoferroviaria'): array
    {
        $url = self::BASE_URL . "/{$uf}/{$type}.xml";
        $stats = ['owners_created' => 0, 'owners_updated' => 0, 'instruments_created' => 0, 'instruments_updated' => 0, 'history_added' => 0, 'errors' => 0];

        try {
            $response = Http::timeout(60)->get($url);
            if (!$response->successful()) {
                Log::error('INMETRO instrument XML import failed', ['url' => $url, 'status' => $response->status()]);
                return ['success' => false, 'error' => "HTTP {$response->status()}", 'stats' => $stats];
            }

            $xml = simplexml_load_string($response->body());
            if (!$xml) {
                return ['success' => false, 'error' => 'Invalid XML', 'stats' => $stats];
            }

            DB::beginTransaction();

            foreach ($xml->children() as $item) {
                try {
                    $ownerName = trim((string) ($item->Proprietario ?? $item->proprietario ?? $item->NomeProprietario ?? ''));
                    if (empty($ownerName)) continue;

                    $city = trim((string) ($item->Municipio ?? $item->municipio ?? $item->MunicipioProprietario ?? ''));
                    $inmetroNumber = trim((string) ($item->NumeroInmetro ?? $item->numeroInmetro ?? $item->Numero ?? ''));

                    if (empty($inmetroNumber)) continue;

                    $document = preg_replace('/\D/', '', (string) ($item->CPF ?? $item->CNPJ ?? $item->Documento ?? ''));
                    $isPF = strlen($document) === 11;

                    $owner = InmetroOwner::where('tenant_id', $tenantId)
                        ->where(function ($q) use ($document, $ownerName) {
                            if ($document) {
                                $q->where('document', $document);
                            } else {
                                $q->where('name', $ownerName);
                            }
                        })
                        ->first();

                    if (!$owner) {
                        $owner = InmetroOwner::create([
                            'tenant_id' => $tenantId,
                            'document' => $document ?: 'SEM-DOC-' . md5($ownerName . $city),
                            'name' => $ownerName,
                            'type' => $isPF ? 'PF' : 'PJ',
                        ]);
                        $stats['owners_created']++;
                    } else {
                        $stats['owners_updated']++;
                    }

                    $location = $owner->locations()
                        ->where('address_city', $city)
                        ->first();

                    if (!$location) {
                        $location = $owner->locations()->create([
                            'address_city' => $city,
                            'address_state' => $uf,
                            'address_street' => trim((string) ($item->Endereco ?? $item->endereco ?? '')),
                            'address_neighborhood' => trim((string) ($item->Bairro ?? $item->bairro ?? '')),
                            'address_zip' => trim((string) ($item->CEP ?? $item->Cep ?? $item->cep ?? '')),
                        ]);
                    }

                    $lastVerification = $this->parseDate((string) ($item->DataUltimaVerificacao ?? $item->dataUltimaVerificacao ?? ''));
                    $validityDate = $this->parseDate((string) ($item->DataValidade ?? $item->dataValidade ?? ''));
                    $resultStr = strtolower(trim((string) ($item->UltimoResultado ?? $item->ultimoResultado ?? $item->Resultado ?? '')));

                    $status = match (true) {
                        str_contains($resultStr, 'aprov') => 'approved',
                        str_contains($resultStr, 'reprov') => 'rejected',
                        str_contains($resultStr, 'repar') => 'repaired',
                        default => 'unknown',
                    };

                    $nextVerification = $validityDate ?? ($lastVerification ? $lastVerification->copy()->addYear() : null);

                    $instrument = InmetroInstrument::where('inmetro_number', $inmetroNumber)->first();

                    $instrumentData = [
                        'location_id' => $location->id,
                        'serial_number' => trim((string) ($item->NumeroSerie ?? $item->numeroSerie ?? '')),
                        'brand' => trim((string) ($item->Marca ?? $item->marca ?? '')),
                        'model' => trim((string) ($item->Modelo ?? $item->modelo ?? '')),
                        'capacity' => trim((string) ($item->Capacidade ?? $item->capacidade ?? '')),
                        'instrument_type' => trim((string) ($item->Tipo ?? $item->tipo ?? '')) ?: (self::INSTRUMENT_TYPES[$type] ?? $type),
                        'current_status' => $status,
                        'last_verification_at' => $lastVerification,
                        'next_verification_at' => $nextVerification,
                        'last_executor' => trim((string) ($item->OrgaoExecutor ?? '')),
                        'source' => 'xml_import',
                    ];

                    if ($instrument) {
                        $instrument->update($instrumentData);
                        $stats['instruments_updated']++;
                    } else {
                        $instrumentData['inmetro_number'] = $inmetroNumber;
                        $instrument = InmetroInstrument::create($instrumentData);
                        $stats['instruments_created']++;
                    }

                    // Create history entry for this verification
                    if ($lastVerification && $instrument) {
                        $executor = trim((string) ($item->OrgaoExecutor ?? ''));
                        $existsHistory = InmetroHistory::where('instrument_id', $instrument->id)
                            ->where('event_date', $lastVerification)
                            ->exists();

                        if (!$existsHistory) {
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
                                'executor' => $executor ?: null,
                                'validity_date' => $validityDate,
                                'source' => 'xml_import',
                            ]);
                            $stats['history_added']++;
                        }
                    }
                } catch (\Exception $e) {
                    $stats['errors']++;
                    Log::warning('INMETRO instrument import error', ['error' => $e->getMessage()]);
                }
            }

            DB::commit();
            return ['success' => true, 'stats' => $stats];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('INMETRO instrument import failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage(), 'stats' => $stats];
        }
    }

    /**
     * Match history repair records to competitor workshops by executor name.
     * Also creates CompetitorInstrumentRepair pivot records.
     */
    public function linkRepairsToCompetitors(int $tenantId): int
    {
        $linked = 0;

        // Get all competitors for this tenant
        $competitors = InmetroCompetitor::where('tenant_id', $tenantId)->get();
        if ($competitors->isEmpty()) return 0;

        // Build lookup: lowercase name → competitor
        $competitorMap = [];
        foreach ($competitors as $competitor) {
            $competitorMap[mb_strtolower(trim($competitor->name))] = $competitor;
        }

        // Find unlinked repair/verification history records with executor names
        $historyRecords = InmetroHistory::whereNull('competitor_id')
            ->whereNotNull('executor')
            ->where('executor', '!=', '')
            ->whereIn('event_type', ['repair', 'verification'])
            ->with('instrument')
            ->get();

        foreach ($historyRecords as $record) {
            $executorLower = mb_strtolower(trim($record->executor));

            // Try exact match first
            $matched = $competitorMap[$executorLower] ?? null;

            // If no exact match, try fuzzy (contains)
            if (!$matched) {
                foreach ($competitorMap as $name => $comp) {
                    if (str_contains($executorLower, $name) || str_contains($name, $executorLower)) {
                        $matched = $comp;
                        break;
                    }
                }
            }

            if ($matched) {
                $record->update(['competitor_id' => $matched->id]);
                $linked++;

                // Also create pivot record for repair events
                if ($record->event_type === 'repair' && $record->instrument) {
                    \App\Models\CompetitorInstrumentRepair::firstOrCreate(
                        [
                            'competitor_id' => $matched->id,
                            'instrument_id' => $record->instrument_id,
                            'repair_date' => $record->event_date,
                        ],
                        [
                            'notes' => $record->notes,
                            'source' => $record->source,
                        ]
                    );

                    // Update competitor stats
                    $matched->increment('total_repairs_done');
                    if (!$matched->last_repair_date || $record->event_date > $matched->last_repair_date) {
                        $matched->update(['last_repair_date' => $record->event_date]);
                    }
                }
            }
        }

        return $linked;
    }

    private function parseDate(string $dateStr): ?Carbon
    {
        if (empty($dateStr)) return null;

        $formats = ['d/m/Y', 'Y-m-d', 'd-m-Y', 'Y-m-d\TH:i:s', 'd/m/Y H:i:s'];
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

