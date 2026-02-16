<?php

namespace App\Services;

use App\Models\WhatsappConfig;
use App\Models\WhatsappMessageLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    /**
     * Envia mensagem de texto simples via WhatsApp.
     */
    public function sendText(int $tenantId, string $phone, string $message, ?object $related = null): ?WhatsappMessageLog
    {
        $config = WhatsappConfig::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->first();

        if (!$config) {
            Log::warning("WhatsApp: nenhuma configuração ativa para tenant {$tenantId}");
            return null;
        }

        $log = WhatsappMessageLog::create([
            'tenant_id' => $tenantId,
            'direction' => 'outbound',
            'phone_to' => $this->normalizePhone($phone),
            'message' => $message,
            'message_type' => 'text',
            'status' => 'pending',
            'related_type' => $related ? get_class($related) : null,
            'related_id' => $related?->id,
        ]);

        try {
            $response = $this->sendViaProvider($config, $log);
            $log->update([
                'status' => 'sent',
                'external_id' => $response['id'] ?? null,
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            $log->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
            Log::error("WhatsApp send failed: {$e->getMessage()}");
        }

        return $log;
    }

    /**
     * Envia mensagem com template (para notificações padronizadas).
     */
    public function sendTemplate(int $tenantId, string $phone, string $templateName, array $params = [], ?object $related = null): ?WhatsappMessageLog
    {
        $config = WhatsappConfig::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->first();

        if (!$config) return null;

        $log = WhatsappMessageLog::create([
            'tenant_id' => $tenantId,
            'direction' => 'outbound',
            'phone_to' => $this->normalizePhone($phone),
            'message' => "Template: {$templateName}",
            'message_type' => 'template',
            'template_name' => $templateName,
            'template_params' => $params,
            'status' => 'pending',
            'related_type' => $related ? get_class($related) : null,
            'related_id' => $related?->id,
        ]);

        try {
            $response = $this->sendTemplateViaProvider($config, $log, $templateName, $params);
            $log->update(['status' => 'sent', 'external_id' => $response['id'] ?? null, 'sent_at' => now()]);
        } catch (\Throwable $e) {
            $log->update(['status' => 'failed', 'error_message' => $e->getMessage()]);
            Log::error("WhatsApp template send failed: {$e->getMessage()}");
        }

        return $log;
    }

    /**
     * Envia documento (PDF) via WhatsApp.
     */
    public function sendDocument(int $tenantId, string $phone, string $filePath, string $fileName, string $caption = '', ?object $related = null): ?WhatsappMessageLog
    {
        $config = WhatsappConfig::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->first();

        if (!$config) return null;

        $log = WhatsappMessageLog::create([
            'tenant_id' => $tenantId,
            'direction' => 'outbound',
            'phone_to' => $this->normalizePhone($phone),
            'message' => $caption ?: "Documento: {$fileName}",
            'message_type' => 'document',
            'status' => 'pending',
            'related_type' => $related ? get_class($related) : null,
            'related_id' => $related?->id,
        ]);

        try {
            $this->sendDocumentViaProvider($config, $phone, $filePath, $fileName, $caption);
            $log->update(['status' => 'sent', 'sent_at' => now()]);
        } catch (\Throwable $e) {
            $log->update(['status' => 'failed', 'error_message' => $e->getMessage()]);
        }

        return $log;
    }

    // ─── Provider-specific implementations ──────────────────────────

    private function sendViaProvider(WhatsappConfig $config, WhatsappMessageLog $log): array
    {
        return match ($config->provider) {
            'evolution' => $this->sendViaEvolution($config, $log->phone_to, $log->message),
            'z-api' => $this->sendViaZApi($config, $log->phone_to, $log->message),
            'meta' => $this->sendViaMeta($config, $log->phone_to, $log->message),
            default => throw new \RuntimeException("Provider não suportado: {$config->provider}"),
        };
    }

    private function sendTemplateViaProvider(WhatsappConfig $config, WhatsappMessageLog $log, string $template, array $params): array
    {
        return match ($config->provider) {
            'evolution' => $this->sendViaEvolution($config, $log->phone_to, $this->resolveTemplate($template, $params)),
            'z-api' => $this->sendViaZApi($config, $log->phone_to, $this->resolveTemplate($template, $params)),
            'meta' => $this->sendMetaTemplate($config, $log->phone_to, $template, $params),
            default => throw new \RuntimeException("Provider não suportado: {$config->provider}"),
        };
    }

    private function sendViaEvolution(WhatsappConfig $config, string $phone, string $message): array
    {
        $response = Http::withHeaders([
            'apikey' => $config->api_key,
        ])->post("{$config->api_url}/message/sendText/{$config->instance_name}", [
            'number' => $phone,
            'text' => $message,
        ]);

        if (!$response->successful()) {
            throw new \RuntimeException("Evolution API error: " . $response->body());
        }

        return $response->json();
    }

    private function sendViaZApi(WhatsappConfig $config, string $phone, string $message): array
    {
        $response = Http::withHeaders([
            'Client-Token' => $config->api_key,
        ])->post("{$config->api_url}/send-text", [
            'phone' => $phone,
            'message' => $message,
        ]);

        if (!$response->successful()) {
            throw new \RuntimeException("Z-API error: " . $response->body());
        }

        return $response->json();
    }

    private function sendViaMeta(WhatsappConfig $config, string $phone, string $message): array
    {
        $response = Http::withToken($config->api_key)
            ->post("{$config->api_url}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $phone,
                'type' => 'text',
                'text' => ['body' => $message],
            ]);

        if (!$response->successful()) {
            throw new \RuntimeException("Meta API error: " . $response->body());
        }

        return $response->json();
    }

    private function sendMetaTemplate(WhatsappConfig $config, string $phone, string $template, array $params): array
    {
        $components = [];
        if (!empty($params)) {
            $components[] = [
                'type' => 'body',
                'parameters' => array_map(fn($v) => ['type' => 'text', 'text' => (string) $v], $params),
            ];
        }

        $response = Http::withToken($config->api_key)
            ->post("{$config->api_url}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $phone,
                'type' => 'template',
                'template' => [
                    'name' => $template,
                    'language' => ['code' => 'pt_BR'],
                    'components' => $components,
                ],
            ]);

        return $response->json();
    }

    private function sendDocumentViaProvider(WhatsappConfig $config, string $phone, string $filePath, string $fileName, string $caption): void
    {
        match ($config->provider) {
            'evolution' => Http::withHeaders(['apikey' => $config->api_key])
                ->attach('file', file_get_contents($filePath), $fileName)
                ->post("{$config->api_url}/message/sendMedia/{$config->instance_name}", [
                    'number' => $phone,
                    'mediatype' => 'document',
                    'caption' => $caption,
                ]),
            default => $this->sendViaProvider($config, (object) ['phone_to' => $phone, 'message' => "{$caption} [Documento: {$fileName}]"]),
        };
    }

    private function normalizePhone(string $phone): string
    {
        $phone = preg_replace('/\D/', '', $phone);
        if (strlen($phone) === 11) $phone = '55' . $phone;
        if (strlen($phone) === 10) $phone = '55' . $phone;
        return $phone;
    }

    private function resolveTemplate(string $template, array $params): string
    {
        $templates = [
            'quote_sent' => "Olá! Seu orçamento #{param1} foi enviado. Acesse o link para visualizar e aprovar: {param2}",
            'wo_completed' => "Olá! Informamos que o serviço da OS #{param1} foi concluído com sucesso.",
            'calibration_expiring' => "Olá! A calibração do equipamento {param1} vence em {param2} dias. Entre em contato para reagendar.",
            'invoice_sent' => "Olá! A NF #{param1} no valor de R$ {param2} foi emitida. Vencimento: {param3}.",
            'payment_reminder' => "Olá! Lembrete: a parcela de R$ {param1} vence em {param2}. Caso já tenha pago, desconsidere.",
            'satisfaction_survey' => "Olá! Como foi o atendimento da OS #{param1}? Avalie em: {param2}",
        ];

        $text = $templates[$template] ?? "Notificação: {$template}";
        foreach ($params as $i => $value) {
            $text = str_replace('{param' . ($i + 1) . '}', $value, $text);
        }

        return $text;
    }
}
