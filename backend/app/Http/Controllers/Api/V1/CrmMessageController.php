<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CrmMessage;
use App\Models\CrmMessageTemplate;
use App\Models\Customer;
use App\Services\MessagingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CrmMessageController extends Controller
{
    public function __construct(private MessagingService $messaging) {}

    // ─── Messages ───────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = CrmMessage::with(['customer:id,name', 'deal:id,title', 'user:id,name']);

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }
        if ($request->filled('deal_id')) {
            $query->where('deal_id', $request->deal_id);
        }
        if ($request->filled('channel')) {
            $query->byChannel($request->channel);
        }
        if ($request->filled('direction')) {
            $query->where('direction', $request->direction);
        }

        $messages = $query->orderByDesc('created_at')
            ->paginate($request->per_page ?? 30);

        return response()->json($messages);
    }

    public function send(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $tenantId = (int) ($user->current_tenant_id ?? $user->tenant_id);

        $data = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'channel' => ['required', Rule::in(['whatsapp', 'email'])],
            'body' => 'required|string',
            'subject' => 'required_if:channel,email|nullable|string|max:255',
            'deal_id' => ['nullable', Rule::exists('crm_deals', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'template_id' => ['nullable', Rule::exists('crm_message_templates', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'variables' => 'nullable|array',
        ]);

        $customer = Customer::findOrFail($data['customer_id']);

        // If template provided, use it
        if (!empty($data['template_id'])) {
            $template = CrmMessageTemplate::findOrFail($data['template_id']);
            $message = $this->messaging->sendFromTemplate(
                $template, $customer,
                $data['variables'] ?? [],
                $data['deal_id'] ?? null,
                $user->id
            );
        } else {
            $message = match ($data['channel']) {
                'whatsapp' => $this->messaging->sendWhatsApp(
                    $tenantId, $customer, $data['body'],
                    $data['deal_id'] ?? null, $user->id
                ),
                'email' => $this->messaging->sendEmail(
                    $tenantId, $customer,
                    $data['subject'] ?? '(Sem assunto)',
                    $data['body'],
                    $data['deal_id'] ?? null, $user->id
                ),
            };
        }

        return response()->json($message->load(['customer:id,name']), 201);
    }

    // ─── Templates ──────────────────────────────────────

    public function templates(Request $request): JsonResponse
    {
        $query = CrmMessageTemplate::active();

        if ($request->filled('channel')) {
            $query->byChannel($request->channel);
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'required|string|max:50',
            'channel' => ['required', Rule::in(['whatsapp', 'email', 'sms'])],
            'subject' => 'nullable|string|max:255',
            'body' => 'required|string',
            'variables' => 'nullable|array',
        ]);

        /** @var \App\Models\User $user */
        $user = $request->user();
        $data['tenant_id'] = (int) ($user->current_tenant_id ?? $user->tenant_id);

        $template = CrmMessageTemplate::create($data);
        return response()->json($template, 201);
    }

    public function updateTemplate(Request $request, CrmMessageTemplate $template): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'subject' => 'nullable|string|max:255',
            'body' => 'sometimes|string',
            'variables' => 'nullable|array',
            'is_active' => 'sometimes|boolean',
        ]);

        $template->update($data);
        return response()->json($template);
    }

    public function destroyTemplate(CrmMessageTemplate $template): JsonResponse
    {
        $template->delete();
        return response()->json(null, 204);
    }

    // ─── Webhooks ────────────────────────────────────────

    /**
     * WhatsApp webhook (Evolution API)
     */
    public function webhookWhatsApp(Request $request): JsonResponse
    {
        $data = $request->all();
        $event = $data['event'] ?? null;

        // Status update (sent, delivered, read)
        if ($event === 'messages.update') {
            $updates = $data['data'] ?? [];
            foreach ((array) $updates as $update) {
                $externalId = $update['key']['id'] ?? null;
                if (!$externalId) continue;

                $message = CrmMessage::where('external_id', $externalId)->first();
                if (!$message) continue;

                $status = $update['update']['status'] ?? null;
                match ($status) {
                    'DELIVERY_ACK' => $message->markDelivered(),
                    'READ', 'PLAYED' => $message->markRead(),
                    default => null,
                };
            }
        }

        // Inbound message
        if ($event === 'messages.upsert') {
            $msgs = $data['data'] ?? [];
            foreach ((array) $msgs as $msg) {
                $isFromMe = $msg['key']['fromMe'] ?? true;
                if ($isFromMe) continue;

                $phone = preg_replace('/\D/', '', $msg['key']['remoteJid'] ?? '');
                $phone = preg_replace('/^55/', '', $phone);
                $body = $msg['message']['conversation']
                    ?? $msg['message']['extendedTextMessage']['text']
                    ?? '[Mídia]';

                // Find tenant via last outbound message to this phone
                $lastOutbound = CrmMessage::where('to_address', 'like', "%{$phone}")
                    ->where('direction', CrmMessage::DIRECTION_OUTBOUND)
                    ->latest()
                    ->first();

                $tenantId = $lastOutbound?->tenant_id;
                $customer = null;

                if ($tenantId) {
                    // Find customer scoped to tenant
                    $customer = Customer::where('tenant_id', $tenantId)
                        ->where(function ($q) use ($phone) {
                            $q->where('phone', 'like', "%{$phone}")
                              ->orWhere('phone2', 'like', "%{$phone}");
                        })->first();
                } else {
                    // Fallback: find customer directly by phone (first contact scenario)
                    $customer = Customer::where(function ($q) use ($phone) {
                        $q->where('phone', 'like', "%{$phone}")
                          ->orWhere('phone2', 'like', "%{$phone}");
                    })->first();

                    $tenantId = $customer?->tenant_id;
                }

                if (!$tenantId || !$customer) continue;

                $this->messaging->recordInbound(
                    $customer->tenant_id,
                    $customer->id,
                    'whatsapp',
                    $body,
                    $phone,
                    $msg['key']['id'] ?? null,
                    null,
                    ['raw' => $msg]
                );
            }
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * Email webhook (generic - for Resend, SendGrid, etc.)
     */
    public function webhookEmail(Request $request): JsonResponse
    {
        $events = $request->all();

        foreach ((array) $events as $event) {
            $type = $event['type'] ?? $event['event'] ?? null;
            $messageId = $event['message_id'] ?? $event['sg_message_id'] ?? null;

            if (!$messageId) continue;

            $message = CrmMessage::where('external_id', $messageId)->first();
            if (!$message) continue;

            match ($type) {
                'delivered', 'email.delivered' => $message->markDelivered(),
                'opened', 'email.opened' => $message->markRead(),
                'bounced', 'email.bounced', 'failed' =>
                    $message->markFailed($event['reason'] ?? 'Bounce'),
                default => null,
            };
        }

        return response()->json(['status' => 'ok']);
    }
}
