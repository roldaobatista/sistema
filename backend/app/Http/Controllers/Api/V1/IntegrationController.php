<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class IntegrationController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1. ZAPIER/WEBHOOKS
    // ═══════════════════════════════════════════════════════════════════

    public function webhooks(): JsonResponse
    {
        $data = DB::table('webhooks')
            ->where('tenant_id', $this->tenantId())
            ->orderBy('event')
            ->get();

        return response()->json(['data' => $data]);
    }

    public function storeWebhook(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => 'required|url',
            'event' => 'required|in:os.created,os.completed,quote.approved,payment.received,certificate.issued,customer.created',
            'secret' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('webhooks')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'url' => $validated['url'],
                'event' => $validated['event'],
                'secret' => $validated['secret'] ?? Str::random(32),
                'is_active' => $validated['is_active'] ?? true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Webhook registrado', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Webhook creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar webhook'], 500);
        }
    }

    public function deleteWebhook(int $id): JsonResponse
    {
        try {
            DB::table('webhooks')
                ->where('id', $id)
                ->where('tenant_id', $this->tenantId())
                ->delete();

            return response()->json(['message' => 'Webhook removido']);
        } catch (\Exception $e) {
            Log::error('Webhook deletion failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover webhook'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. ERP SYNC (ContaAzul/Omie)
    // ═══════════════════════════════════════════════════════════════════

    public function erpSyncStatus(): JsonResponse
    {
        $syncs = DB::table('erp_sync_logs')
            ->where('tenant_id', $this->tenantId())
            ->orderByDesc('synced_at')
            ->limit(20)
            ->get();

        return response()->json(['data' => $syncs]);
    }

    public function triggerErpSync(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => 'required|in:conta_azul,omie,bling,tiny',
            'modules' => 'required|array|min:1',
            'modules.*' => 'in:customers,products,invoices,payments',
        ]);

        try {
            $id = DB::table('erp_sync_logs')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'provider' => $validated['provider'],
                'modules' => json_encode($validated['modules']),
                'status' => 'queued',
                'synced_at' => now(),
                'created_by' => auth()->id(),
            ]);

            return response()->json(['message' => 'Sincronização adicionada à fila', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('ERP sync trigger failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao iniciar sincronização'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. PARTNER MARKETPLACE
    // ═══════════════════════════════════════════════════════════════════

    public function marketplace(): JsonResponse
    {
        $partners = DB::table('marketplace_partners')
            ->where('is_active', true)
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $partners]);
    }

    public function requestPartnerIntegration(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'partner_id' => 'required|exists:marketplace_partners,id',
            'notes' => 'nullable|string',
        ]);

        try {
            $id = DB::table('marketplace_requests')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'partner_id' => $validated['partner_id'],
                'notes' => $validated['notes'] ?? null,
                'status' => 'pending',
                'created_by' => auth()->id(),
                'created_at' => now(),
            ]);

            return response()->json(['message' => 'Solicitação enviada ao parceiro', 'id' => $id], 201);
        } catch (\Exception $e) {
            Log::error('Partner integration request failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao solicitar integração'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. SSO (Google/Microsoft)
    // ═══════════════════════════════════════════════════════════════════

    public function ssoConfig(): JsonResponse
    {
        $config = DB::table('sso_configurations')
            ->where('tenant_id', $this->tenantId())
            ->get();

        return response()->json(['data' => $config]);
    }

    public function updateSsoConfig(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => 'required|in:google,microsoft,okta',
            'client_id' => 'required|string',
            'client_secret' => 'required|string',
            'tenant_domain' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        try {
            DB::table('sso_configurations')->updateOrInsert(
                ['tenant_id' => $this->tenantId(), 'provider' => $validated['provider']],
                [
                    'client_id' => encrypt($validated['client_id']),
                    'client_secret' => encrypt($validated['client_secret']),
                    'tenant_domain' => $validated['tenant_domain'] ?? null,
                    'is_active' => $validated['is_active'] ?? true,
                    'updated_at' => now(),
                ]
            );

            return response()->json(['message' => 'SSO configurado com sucesso']);
        } catch (\Exception $e) {
            Log::error('SSO config update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao configurar SSO'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. SLACK/TEAMS NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════════

    public function slackTeamsConfig(): JsonResponse
    {
        $config = DB::table('notification_channels')
            ->where('tenant_id', $this->tenantId())
            ->whereIn('type', ['slack', 'teams'])
            ->get();

        return response()->json(['data' => $config]);
    }

    public function storeNotificationChannel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|in:slack,teams',
            'webhook_url' => 'required|url',
            'channel_name' => 'nullable|string|max:100',
            'events' => 'required|array|min:1',
            'events.*' => 'in:os.created,os.completed,quote.approved,payment.received,alert.critical',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('notification_channels')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'type' => $validated['type'],
                'webhook_url' => $validated['webhook_url'],
                'channel_name' => $validated['channel_name'] ?? null,
                'events' => json_encode($validated['events']),
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Canal configurado', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Notification channel creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao configurar canal'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. SHIPPING CALCULATOR (Correios/Transportadoras)
    // ═══════════════════════════════════════════════════════════════════

    public function calculateShipping(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'origin_zip' => 'required|string|max:9',
            'destination_zip' => 'required|string|max:9',
            'weight_kg' => 'required|numeric|min:0.1',
            'dimensions' => 'nullable|array',
            'dimensions.length' => 'nullable|numeric',
            'dimensions.width' => 'nullable|numeric',
            'dimensions.height' => 'nullable|numeric',
        ]);

        // Simulated shipping quotes
        $weight = $validated['weight_kg'];
        $quotes = [
            ['carrier' => 'Correios PAC', 'price' => round(15 + ($weight * 3.5), 2), 'days' => rand(5, 10), 'type' => 'economic'],
            ['carrier' => 'Correios SEDEX', 'price' => round(25 + ($weight * 6.0), 2), 'days' => rand(2, 5), 'type' => 'express'],
            ['carrier' => 'Transportadora A', 'price' => round(20 + ($weight * 4.0), 2), 'days' => rand(3, 7), 'type' => 'standard'],
        ];

        return response()->json(['data' => $quotes]);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. MARKETING TOOLS (RD Station)
    // ═══════════════════════════════════════════════════════════════════

    public function marketingIntegrationConfig(): JsonResponse
    {
        $config = DB::table('marketing_integrations')
            ->where('tenant_id', $this->tenantId())
            ->first();

        return response()->json(['data' => $config]);
    }

    public function updateMarketingConfig(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => 'required|in:rd_station,hubspot,mailchimp,active_campaign',
            'api_key' => 'required|string',
            'sync_contacts' => 'boolean',
            'sync_events' => 'boolean',
        ]);

        try {
            DB::table('marketing_integrations')->updateOrInsert(
                ['tenant_id' => $this->tenantId()],
                [
                    'provider' => $validated['provider'],
                    'api_key' => encrypt($validated['api_key']),
                    'sync_contacts' => $validated['sync_contacts'] ?? true,
                    'sync_events' => $validated['sync_events'] ?? false,
                    'updated_at' => now(),
                ]
            );

            return response()->json(['message' => 'Integração de marketing configurada']);
        } catch (\Exception $e) {
            Log::error('Marketing config update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao configurar integração'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. SWAGGER DOCS
    // ═══════════════════════════════════════════════════════════════════

    public function swaggerDoc(): JsonResponse
    {
        $spec = [
            'openapi' => '3.0.3',
            'info' => [
                'title' => 'Kalibrium ERP API',
                'version' => '1.0.0',
                'description' => 'API pública do sistema Kalibrium ERP para calibração e metrologia.',
            ],
            'servers' => [['url' => config('app.url') . '/api/v1']],
            'paths' => [
                '/work-orders' => ['get' => ['summary' => 'Lista ordens de serviço', 'tags' => ['OS']]],
                '/customers' => ['get' => ['summary' => 'Lista clientes', 'tags' => ['Clientes']]],
                '/quotes' => ['get' => ['summary' => 'Lista orçamentos', 'tags' => ['Orçamentos']]],
                '/products' => ['get' => ['summary' => 'Lista produtos/serviços', 'tags' => ['Produtos']]],
                '/portal/dashboard/{customerId}' => ['get' => ['summary' => 'Dashboard do cliente', 'tags' => ['Portal']]],
            ],
        ];

        return response()->json($spec);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 9. OUTLOOK/GMAIL PLUGINS
    // ═══════════════════════════════════════════════════════════════════

    public function emailPluginManifest(): JsonResponse
    {
        return response()->json([
            'name' => 'Kalibrium ERP Mail Plugin',
            'version' => '1.0.0',
            'description' => 'Integre seu email com o Kalibrium ERP para vincular emails a OS e clientes',
            'capabilities' => ['link_emails_to_os', 'create_ticket_from_email', 'view_customer_info', 'attach_to_crm'],
            'supported_providers' => ['outlook', 'gmail'],
            'webhook_url' => config('app.url') . '/api/v1/integrations/email-plugin/webhook',
        ]);
    }

    public function emailPluginWebhook(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|in:link_email,create_ticket,lookup_customer',
            'email_subject' => 'nullable|string',
            'email_from' => 'nullable|email',
            'entity_id' => 'nullable|integer',
            'entity_type' => 'nullable|in:work_order,customer,quote',
        ]);

        try {
            $result = match ($validated['action']) {
                'lookup_customer' => DB::table('customers')
                    ->where('tenant_id', $this->tenantId())
                    ->where('email', $validated['email_from'])
                    ->first(['id', 'name', 'email', 'phone']),
                'create_ticket' => ['ticket_id' => DB::table('support_tickets')->insertGetId([
                    'tenant_id' => $this->tenantId(),
                    'source' => 'email_plugin',
                    'description' => $validated['email_subject'] ?? 'Ticket por email',
                    'status' => 'open',
                    'created_at' => now(),
                    'updated_at' => now(),
                ])],
                default => ['status' => 'processed'],
            };

            return response()->json(['data' => $result]);
        } catch (\Exception $e) {
            Log::error('Email plugin webhook failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao processar webhook'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 10. POWER BI CONNECTOR
    // ═══════════════════════════════════════════════════════════════════

    public function powerBiDataExport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dataset' => 'required|in:work_orders,customers,financials,products,certificates,nps',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'format' => 'nullable|in:json,csv',
        ]);

        $tenantId = $this->tenantId();
        $table = match ($validated['dataset']) {
            'work_orders' => 'work_orders',
            'customers' => 'customers',
            'financials' => 'accounts_receivable',
            'products' => 'products',
            'certificates' => 'calibration_certificates',
            'nps' => 'nps_surveys',
        };

        $query = DB::table($table)->where('tenant_id', $tenantId);

        if (!empty($validated['date_from'])) {
            $query->where('created_at', '>=', $validated['date_from']);
        }
        if (!empty($validated['date_to'])) {
            $query->where('created_at', '<=', $validated['date_to']);
        }

        $data = $query->limit(10000)->get();

        return response()->json([
            'data' => $data,
            'dataset' => $validated['dataset'],
            'total_records' => $data->count(),
            'exported_at' => now()->toIso8601String(),
        ]);
    }
}
