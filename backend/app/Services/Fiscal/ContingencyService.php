<?php

namespace App\Services\Fiscal;

use App\Models\FiscalNote;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Manages NF-e contingency mode (offline emission).
 *
 * When SEFAZ is unavailable, notes are saved locally with contingency_mode=true
 * and status=pending. A scheduled job or manual trigger retransmits them when
 * connectivity is restored.
 */
class ContingencyService
{
    private FiscalProvider $provider;

    public function __construct(FiscalProvider $provider)
    {
        $this->provider = $provider;
    }

    /**
     * Save an NF-e in contingency mode (offline).
     * The note is persisted locally and queued for later transmission.
     */
    public function saveOffline(FiscalNote $note, array $payload): void
    {
        $note->update([
            'status' => FiscalNote::STATUS_PENDING,
            'contingency_mode' => true,
            'raw_response' => ['offline_payload' => $payload, 'queued_at' => now()->toIso8601String()],
        ]);

        Log::info('ContingencyService: NF-e saved offline', [
            'note_id' => $note->id,
            'reference' => $note->reference,
        ]);
    }

    /**
     * Retransmit all pending contingency notes for a tenant.
     * Returns an array of results per note.
     */
    public function retransmitPending(Tenant $tenant): array
    {
        $pendingNotes = FiscalNote::forTenant($tenant->id)
            ->where('contingency_mode', true)
            ->where('status', FiscalNote::STATUS_PENDING)
            ->orderBy('created_at')
            ->get();

        if ($pendingNotes->isEmpty()) {
            return ['total' => 0, 'success' => 0, 'failed' => 0, 'results' => []];
        }

        // Check SEFAZ availability first
        if (!$this->isSefazAvailable()) {
            return [
                'total' => $pendingNotes->count(),
                'success' => 0,
                'failed' => 0,
                'message' => 'SEFAZ ainda indisponível',
                'results' => [],
            ];
        }

        $results = [];
        $success = 0;
        $failed = 0;

        foreach ($pendingNotes as $note) {
            $result = $this->retransmitNote($note);
            $results[] = $result;

            if ($result['success']) {
                $success++;
            } else {
                $failed++;
            }
        }

        return [
            'total' => $pendingNotes->count(),
            'success' => $success,
            'failed' => $failed,
            'results' => $results,
        ];
    }

    /**
     * Retransmit a single contingency note.
     */
    public function retransmitNote(FiscalNote $note): array
    {
        try {
            $payload = $note->raw_response['offline_payload'] ?? null;

            if (!$payload) {
                Log::warning('ContingencyService: No offline payload', ['note_id' => $note->id]);
                return [
                    'note_id' => $note->id,
                    'success' => false,
                    'error' => 'Payload offline não encontrado',
                ];
            }

            $payload['ref'] = $note->reference;

            $result = $note->isNFe()
                ? $this->provider->emitirNFe($payload)
                : $this->provider->emitirNFSe($payload);

            if ($result->success) {
                $note->update([
                    'contingency_mode' => false,
                    'status' => $result->status === 'processing'
                        ? FiscalNote::STATUS_PROCESSING
                        : FiscalNote::STATUS_AUTHORIZED,
                    'provider_id' => $result->providerId ?? $result->reference,
                    'access_key' => $result->accessKey,
                    'protocol_number' => $result->protocolNumber,
                    'verification_code' => $result->verificationCode,
                    'pdf_url' => $result->pdfUrl,
                    'xml_url' => $result->xmlUrl,
                    'raw_response' => $result->rawResponse,
                    'issued_at' => now(),
                ]);

                if ($result->number) {
                    $note->update(['number' => $result->number]);
                }
                if ($result->series) {
                    $note->update(['series' => $result->series]);
                }

                Log::info('ContingencyService: Retransmitted successfully', [
                    'note_id' => $note->id,
                    'reference' => $note->reference,
                ]);

                return ['note_id' => $note->id, 'success' => true, 'reference' => $note->reference];
            }

            Log::warning('ContingencyService: Retransmission failed', [
                'note_id' => $note->id,
                'error' => $result->errorMessage,
            ]);

            return [
                'note_id' => $note->id,
                'success' => false,
                'error' => $result->errorMessage,
            ];
        } catch (\Exception $e) {
            Log::error('ContingencyService: Exception during retransmission', [
                'note_id' => $note->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'note_id' => $note->id,
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check if SEFAZ is available by consulting the service status.
     */
    public function isSefazAvailable(string $uf = 'MT'): bool
    {
        try {
            $result = $this->provider->consultarStatusServico($uf);
            return $result->success;
        } catch (\Exception $e) {
            Log::warning('ContingencyService: SEFAZ status check failed', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Get count of pending contingency notes for a tenant.
     */
    public function pendingCount(int $tenantId): int
    {
        return FiscalNote::forTenant($tenantId)
            ->where('contingency_mode', true)
            ->where('status', FiscalNote::STATUS_PENDING)
            ->count();
    }
}
