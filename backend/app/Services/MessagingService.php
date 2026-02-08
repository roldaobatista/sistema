<?php

namespace App\Services;

use App\Models\CrmMessage;
use App\Models\CrmMessageTemplate;
use App\Models\Customer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class MessagingService
{
    /**
     * Send a WhatsApp message via Evolution API.
     */
    public function sendWhatsApp(
        int $tenantId,
        Customer $customer,
        string $body,
        ?int $dealId = null,
        ?int $userId = null,
        array $attachments = []
    ): CrmMessage {
        $phone = $this->cleanPhone($customer->phone);

        $message = CrmMessage::create([
            'tenant_id' => $tenantId,
            'customer_id' => $customer->id,
            'deal_id' => $dealId,
            'user_id' => $userId,
            'channel' => 'whatsapp',
            'direction' => 'outbound',
            'status' => 'pending',
            'body' => $body,
            'to_address' => $phone,
            'provider' => 'evolution-api',
            'attachments' => $attachments ?: null,
        ]);

        try {
            $baseUrl = config('services.evolution.url');
            $apiKey = config('services.evolution.api_key');
            $instance = config('services.evolution.instance');

            if (!$baseUrl || !$apiKey) {
                $message->markFailed('Evolution API não configurada');
                return $message;
            }

            $response = Http::withHeaders([
                'apikey' => $apiKey,
            ])->post("{$baseUrl}/message/sendText/{$instance}", [
                'number' => "55{$phone}",
                'text' => $body,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $message->markSent($data['key']['id'] ?? null);
                $message->logToTimeline();

                // Update customer last contact
                Customer::where('id', $customer->id)
                    ->update(['last_contact_at' => now()]);
            } else {
                $message->markFailed($response->body());
                Log::error('WhatsApp send failed', [
                    'customer' => $customer->id,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Exception $e) {
            $message->markFailed($e->getMessage());
            Log::error('WhatsApp send exception', [
                'customer' => $customer->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $message;
    }

    /**
     * Send an email message.
     */
    public function sendEmail(
        int $tenantId,
        Customer $customer,
        string $subject,
        string $body,
        ?int $dealId = null,
        ?int $userId = null,
        array $attachments = []
    ): CrmMessage {
        $message = CrmMessage::create([
            'tenant_id' => $tenantId,
            'customer_id' => $customer->id,
            'deal_id' => $dealId,
            'user_id' => $userId,
            'channel' => 'email',
            'direction' => 'outbound',
            'status' => 'pending',
            'subject' => $subject,
            'body' => $body,
            'to_address' => $customer->email,
            'provider' => config('mail.default'),
            'attachments' => $attachments ?: null,
        ]);

        try {
            Mail::html($body, function ($mail) use ($customer, $subject) {
                $mail->to($customer->email, $customer->name)
                    ->subject($subject);
            });

            $message->markSent();
            $message->logToTimeline();

            Customer::where('id', $customer->id)
                ->update(['last_contact_at' => now()]);
        } catch (\Exception $e) {
            $message->markFailed($e->getMessage());
            Log::error('Email send exception', [
                'customer' => $customer->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $message;
    }

    /**
     * Send message from template.
     */
    public function sendFromTemplate(
        CrmMessageTemplate $template,
        Customer $customer,
        array $variables = [],
        ?int $dealId = null,
        ?int $userId = null
    ): CrmMessage {
        $body = $template->render(array_merge([
            'nome' => $customer->name,
            'empresa' => $customer->name,
            'email' => $customer->email,
            'telefone' => $customer->phone,
        ], $variables));

        return match ($template->channel) {
            'whatsapp' => $this->sendWhatsApp(
                $customer->tenant_id, $customer, $body, $dealId, $userId
            ),
            'email' => $this->sendEmail(
                $customer->tenant_id, $customer,
                $template->renderSubject($variables) ?? $template->name,
                $body, $dealId, $userId
            ),
            default => throw new \InvalidArgumentException("Canal não suportado: {$template->channel}"),
        };
    }

    /**
     * Record an inbound message (from webhook).
     */
    public function recordInbound(
        int $tenantId,
        int $customerId,
        string $channel,
        string $body,
        ?string $fromAddress = null,
        ?string $externalId = null,
        ?string $subject = null,
        ?array $metadata = null
    ): CrmMessage {
        $message = CrmMessage::create([
            'tenant_id' => $tenantId,
            'customer_id' => $customerId,
            'channel' => $channel,
            'direction' => 'inbound',
            'status' => 'delivered',
            'body' => $body,
            'subject' => $subject,
            'from_address' => $fromAddress,
            'external_id' => $externalId,
            'delivered_at' => now(),
            'metadata' => $metadata,
        ]);

        $message->logToTimeline();

        Customer::where('id', $customerId)
            ->update(['last_contact_at' => now()]);

        return $message;
    }

    private function cleanPhone(string $phone): string
    {
        return preg_replace('/\D/', '', $phone);
    }
}
