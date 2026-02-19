<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CrmMessage;
use App\Models\CrmMessageTemplate;
use App\Models\Customer;
use App\Services\MessagingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CrmMessageController extends Controller
{
    public function __construct(private MessagingService $messaging) {}

    // ─── Messages ───────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        try {
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
        } catch (\Exception $e) {
            Log::error('CrmMessage index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar mensagens'], 500);
        }
    }

    public function send(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

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

            DB::commit();
            return response()->json($message->load(['customer:id,name']), 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('CrmMessage send failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao enviar mensagem'], 500);
        }
    }

    // ─── Templates ──────────────────────────────────────

    public function templates(Request $request): JsonResponse
    {
        try {
            $query = CrmMessageTemplate::active();

            if ($request->filled('channel')) {
                $query->byChannel($request->channel);
            }

            return response()->json($query->orderBy('name')->get());
        } catch (\Exception $e) {
            Log::error('CrmMessage templates failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar templates'], 500);
        }
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

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

            DB::commit();
            return response()->json($template, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('CrmMessage storeTemplate failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar template'], 500);
        }
    }

    public function updateTemplate(Request $request, CrmMessageTemplate $template): JsonResponse
    {
        try {
            DB::beginTransaction();

            $data = $request->validate([
                'name' => 'sometimes|string|max:100',
                'subject' => 'nullable|string|max:255',
                'body' => 'sometimes|string',
                'variables' => 'nullable|array',
                'is_active' => 'sometimes|boolean',
            ]);

            $template->update($data);

            DB::commit();
            return response()->json($template);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('CrmMessage updateTemplate failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar template'], 500);
        }
    }

    public function destroyTemplate(CrmMessageTemplate $template): JsonResponse
    {
        try {
            $template->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('CrmMessage destroyTemplate failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir template'], 500);
        }
    }

    // ─── Webhooks ────────────────────────────────────────

    public function webhookWhatsApp(Request $request): JsonResponse
    {
        try {
            $data = $request->all();
            $event = $data['event'] ?? null;

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

                    $lastOutbound = CrmMessage::where('to_address', 'like', "%{$phone}")
                        ->where('direction', CrmMessage::DIRECTION_OUTBOUND)
                        ->latest()
                        ->first();

                    $tenantId = $lastOutbound?->tenant_id;
                    $customer = null;

                    if ($tenantId) {
                        $customer = Customer::where('tenant_id', $tenantId)
                            ->where(function ($q) use ($phone) {
                                $q->where('phone', 'like', "%{$phone}")
                                  ->orWhere('phone2', 'like', "%{$phone}");
                            })->first();
                    } else {
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
        } catch (\Exception $e) {
            Log::error('CrmMessage webhookWhatsApp failed', ['error' => $e->getMessage()]);
            Log::error($e->getMessage(), ['exception' => $e]); return response()->json(['status' => 'error', 'message' => 'Erro interno do servidor.'], 500);
        }
    }

    public function webhookEmail(Request $request): JsonResponse
    {
        try {
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
        } catch (\Exception $e) {
            Log::error('CrmMessage webhookEmail failed', ['error' => $e->getMessage()]);
            Log::error($e->getMessage(), ['exception' => $e]); return response()->json(['status' => 'error', 'message' => 'Erro interno do servidor.'], 500);
        }
    }
}
