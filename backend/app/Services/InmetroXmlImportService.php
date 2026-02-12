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

    public function importInstruments(int $tenantId, string $uf = 'MT', string $type = 'balanca-rodoferroviaria'): array
    {
        $url = self::BASE_URL . "/{$uf}/{$type}.xml";
        $stats = ['owners_created' => 0, 'owners_updated' => 0, 'instruments_created' => 0, 'instruments_updated' => 0, 'history_added' => 0, 'errors' => 0];

        try {
            $response = Http::timeout(30)->get($url);
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
                        'instrument_type' => trim((string) ($item->Tipo ?? $item->tipo ?? $type)),
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
