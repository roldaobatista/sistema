<?php

namespace App\Services\Fiscal;

use App\Models\FiscalNote;
use App\Models\FiscalWebhook;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * #10 — Dispatch webhook notifications when fiscal note status changes.
 */
class FiscalWebhookService
{
    public function dispatch(FiscalNote $note, string $event): void
    {
        $webhooks = FiscalWebhook::where('tenant_id', $note->tenant_id)
            ->where('active', true)
            ->get();

        foreach ($webhooks as $webhook) {
            $events = is_array($webhook->events) ? $webhook->events : json_decode($webhook->events, true);
            if (! in_array($event, $events)) {
                continue;
            }

            $this->send($webhook, $note, $event);
        }
    }

    private function send(FiscalWebhook $webhook, FiscalNote $note, string $event): void
    {
        $payload = [
            'event' => $event,
            'timestamp' => now()->toIso8601String(),
            'note' => [
                'id' => $note->id,
                'type' => $note->type,
                'number' => $note->number,
                'series' => $note->series,
                'status' => $note->status,
                'access_key' => $note->access_key,
                'total_amount' => $note->total_amount,
                'customer_id' => $note->customer_id,
                'reference' => $note->reference,
            ],
        ];

        $headers = ['Content-Type' => 'application/json'];
        if ($webhook->secret) {
            $headers['X-Webhook-Signature'] = hash_hmac('sha256', json_encode($payload), $webhook->secret);
        }

        try {
            $response = Http::withHeaders($headers)
                ->timeout(10)
                ->post($webhook->url, $payload);

            if ($response->successful()) {
                $webhook->update([
                    'failure_count' => 0,
                    'last_triggered_at' => now(),
                ]);
            } else {
                $this->handleFailure($webhook, "HTTP {$response->status()}");
            }
        } catch (\Exception $e) {
            $this->handleFailure($webhook, $e->getMessage());
        }
    }

    private function handleFailure(FiscalWebhook $webhook, string $error): void
    {
        $failures = $webhook->failure_count + 1;
        $webhook->update([
            'failure_count' => $failures,
            'active' => $failures < 10, // disable after 10 consecutive failures
        ]);

        Log::warning('FiscalWebhook: delivery failed', [
            'webhook_id' => $webhook->id,
            'failures' => $failures,
            'error' => $error,
        ]);
    }

    public function listForTenant(int $tenantId): \Illuminate\Database\Eloquent\Collection
    {
        return FiscalWebhook::where('tenant_id', $tenantId)->get();
    }

    public function createWebhook(int $tenantId, array $data): FiscalWebhook
    {
        return FiscalWebhook::create([
            'tenant_id' => $tenantId,
            'url' => $data['url'],
            'events' => $data['events'] ?? ['authorized', 'cancelled', 'rejected'],
            'secret' => $data['secret'] ?? bin2hex(random_bytes(16)),
            'active' => true,
        ]);
    }

    public function deleteWebhook(int $webhookId, int $tenantId): bool
    {
        return FiscalWebhook::where('id', $webhookId)
            ->where('tenant_id', $tenantId)
            ->delete() > 0;
    }
}
