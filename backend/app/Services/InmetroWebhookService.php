<?php

namespace App\Services;

use App\Models\InmetroWebhook;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class InmetroWebhookService
{
    // ── Feature #49: API Pública (data aggregation for external access) ──

    public function getPublicInstrumentData(int $tenantId, ?string $city = null): array
    {
        $query = \App\Models\InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId));

        if ($city) {
            $query->whereHas('location', fn($q) => $q->where('address_city', $city));
        }

        return $query->with('location:id,address_city,address_state')
            ->limit(100)
            ->get()
            ->map(fn($inst) => [
                'inmetro_number' => $inst->inmetro_number,
                'brand' => $inst->brand,
                'model' => $inst->model,
                'capacity' => $inst->capacity,
                'status' => $inst->current_status,
                'next_verification' => $inst->next_verification_at?->toDateString(),
                'city' => $inst->location?->address_city,
                'state' => $inst->location?->address_state,
            ])
            ->toArray();
    }

    // ── Feature #50: Configurable Webhooks ──

    public function listWebhooks(int $tenantId): array
    {
        return InmetroWebhook::where('tenant_id', $tenantId)
            ->orderBy('event_type')
            ->get()
            ->toArray();
    }

    public function createWebhook(array $data, int $tenantId): InmetroWebhook
    {
        return InmetroWebhook::create([
            'tenant_id' => $tenantId,
            'event_type' => $data['event_type'],
            'url' => $data['url'],
            'secret' => $data['secret'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    public function updateWebhook(int $id, array $data, int $tenantId): InmetroWebhook
    {
        $webhook = InmetroWebhook::where('tenant_id', $tenantId)->findOrFail($id);
        $webhook->update($data);
        return $webhook->fresh();
    }

    public function deleteWebhook(int $id, int $tenantId): void
    {
        InmetroWebhook::where('tenant_id', $tenantId)->findOrFail($id)->delete();
    }

    public function dispatchEvent(int $tenantId, string $eventType, array $payload): array
    {
        $webhooks = InmetroWebhook::where('tenant_id', $tenantId)
            ->forEvent($eventType)
            ->active()
            ->get();

        $results = [];
        foreach ($webhooks as $webhook) {
            try {
                $headers = ['Content-Type' => 'application/json'];
                if ($webhook->secret) {
                    $headers['X-Webhook-Secret'] = $webhook->secret;
                    $headers['X-Webhook-Signature'] = hash_hmac('sha256', json_encode($payload), $webhook->secret);
                }

                $response = Http::timeout(10)
                    ->withHeaders($headers)
                    ->post($webhook->url, [
                        'event' => $eventType,
                        'timestamp' => now()->toIso8601String(),
                        'data' => $payload,
                    ]);

                $webhook->update([
                    'last_triggered_at' => now(),
                    'failure_count' => $response->successful() ? 0 : $webhook->failure_count + 1,
                ]);

                // Disable after 10 consecutive failures
                if ($webhook->failure_count >= 10) {
                    $webhook->update(['is_active' => false]);
                }

                $results[] = [
                    'webhook_id' => $webhook->id,
                    'url' => $webhook->url,
                    'status' => $response->status(),
                    'success' => $response->successful(),
                ];
            } catch (\Exception $e) {
                $webhook->increment('failure_count');
                Log::warning('Webhook dispatch failed', ['webhook_id' => $webhook->id, 'error' => $e->getMessage()]);

                $results[] = [
                    'webhook_id' => $webhook->id,
                    'url' => $webhook->url,
                    'status' => 0,
                    'success' => false,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    public function getAvailableEvents(): array
    {
        return [
            'new_lead' => 'Novo lead detectado na importação',
            'lead_expiring' => 'Calibração de lead vencendo',
            'instrument_rejected' => 'Instrumento reprovado pelo INMETRO',
            'lead_converted' => 'Lead convertido em cliente CRM',
            'competitor_change' => 'Movimentação significativa de concorrente',
            'churn_detected' => 'Risco de churn detectado para cliente',
            'new_registration' => 'Novo registro de instrumento INMETRO',
        ];
    }
}
