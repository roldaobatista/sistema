<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class InfraIntegrationController extends Controller
{
    // ─── #49 Webhook Configurável ───────────────────────────────

    public function webhookConfigs(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        return response()->json(
            DB::table('webhook_configs')->where('company_id', $tenantId)->get()
        );
    }

    public function storeWebhook(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'url' => 'required|url|max:500',
            'events' => 'required|array|min:1',
            'events.*' => 'string|in:os.created,os.completed,os.cancelled,payment.received,quote.approved,lead.created,stock.low,calibration.due',
            'secret' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'headers' => 'nullable|array',
        ]);

        $data['company_id'] = $request->user()->company_id;
        $data['secret'] = $data['secret'] ?? Str::random(32);
        $data['events'] = json_encode($data['events']);
        $data['headers'] = json_encode($data['headers'] ?? []);

        $id = DB::table('webhook_configs')->insertGetId(array_merge($data, [
            'created_at' => now(), 'updated_at' => now(),
        ]));

        return response()->json(['id' => $id, 'secret' => $data['secret']], 201);
    }

    public function updateWebhook(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'url' => 'sometimes|url|max:500',
            'events' => 'sometimes|array|min:1',
            'is_active' => 'boolean',
            'headers' => 'nullable|array',
        ]);

        if (isset($data['events'])) $data['events'] = json_encode($data['events']);
        if (isset($data['headers'])) $data['headers'] = json_encode($data['headers']);

        DB::table('webhook_configs')
            ->where('id', $id)
            ->where('company_id', $request->user()->company_id)
            ->update(array_merge($data, ['updated_at' => now()]));

        return response()->json(['message' => 'Updated']);
    }

    public function deleteWebhook(Request $request, int $id): JsonResponse
    {
        DB::table('webhook_configs')
            ->where('id', $id)->where('company_id', $request->user()->company_id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function testWebhook(Request $request, int $id): JsonResponse
    {
        $webhook = DB::table('webhook_configs')
            ->where('id', $id)->where('company_id', $request->user()->company_id)->first();

        if (!$webhook) return response()->json(['message' => 'Not found'], 404);

        $payload = ['event' => 'test', 'timestamp' => now()->toIso8601String(), 'data' => ['message' => 'Test webhook']];
        $signature = hash_hmac('sha256', json_encode($payload), $webhook->secret);

        try {
            $response = Http::timeout(10)
                ->withHeaders(array_merge(json_decode($webhook->headers ?? '{}', true), [
                    'X-Webhook-Signature' => $signature,
                    'X-Webhook-Event' => 'test',
                ]))
                ->post($webhook->url, $payload);

            $success = $response->successful();

            DB::table('webhook_logs')->insert([
                'webhook_config_id' => $id,
                'event' => 'test',
                'payload' => json_encode($payload),
                'response_code' => $response->status(),
                'response_body' => substr($response->body(), 0, 1000),
                'success' => $success,
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => $success,
                'status_code' => $response->status(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function webhookLogs(Request $request, int $id): JsonResponse
    {
        $logs = DB::table('webhook_logs')
            ->where('webhook_config_id', $id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json($logs);
    }

    // ─── #50 API Pública com Documentação Swagger ──────────────

    public function apiKeys(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $keys = DB::table('api_keys')
            ->where('company_id', $tenantId)
            ->get(['id', 'name', 'prefix', 'permissions', 'last_used_at', 'expires_at', 'is_active', 'created_at']);

        return response()->json($keys);
    }

    public function createApiKey(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'permissions' => 'required|array|min:1',
            'permissions.*' => 'string|in:read:os,write:os,read:customers,read:stock,read:financial,read:reports',
            'expires_at' => 'nullable|date|after:today',
        ]);

        $tenantId = $request->user()->company_id;
        $key = Str::random(48);
        $prefix = substr($key, 0, 8);

        $id = DB::table('api_keys')->insertGetId([
            'company_id' => $tenantId,
            'name' => $data['name'],
            'key_hash' => hash('sha256', $key),
            'prefix' => $prefix,
            'permissions' => json_encode($data['permissions']),
            'expires_at' => $data['expires_at'] ?? null,
            'is_active' => true,
            'created_by' => $request->user()->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json([
            'id' => $id,
            'api_key' => "klb_{$key}", // Show ONCE, never again
            'prefix' => "klb_{$prefix}...",
            'message' => 'Save this key, it will not be shown again',
        ], 201);
    }

    public function revokeApiKey(Request $request, int $id): JsonResponse
    {
        DB::table('api_keys')
            ->where('id', $id)->where('company_id', $request->user()->company_id)
            ->update(['is_active' => false, 'revoked_at' => now(), 'updated_at' => now()]);

        return response()->json(['message' => 'API key revoked']);
    }

    public function swaggerSpec(Request $request): JsonResponse
    {
        $spec = [
            'openapi' => '3.0.3',
            'info' => [
                'title' => 'KALIBRIUM ERP Public API',
                'version' => '1.0.0',
                'description' => 'API pública para integração com sistemas externos',
            ],
            'servers' => [
                ['url' => config('app.url') . '/api/v1/public', 'description' => 'Production'],
            ],
            'security' => [
                ['ApiKeyAuth' => []],
            ],
            'components' => [
                'securitySchemes' => [
                    'ApiKeyAuth' => ['type' => 'apiKey', 'in' => 'header', 'name' => 'X-API-Key'],
                ],
            ],
            'paths' => [
                '/work-orders' => [
                    'get' => [
                        'summary' => 'List work orders',
                        'tags' => ['Work Orders'],
                        'parameters' => [
                            ['name' => 'status', 'in' => 'query', 'schema' => ['type' => 'string']],
                            ['name' => 'from', 'in' => 'query', 'schema' => ['type' => 'string', 'format' => 'date']],
                            ['name' => 'to', 'in' => 'query', 'schema' => ['type' => 'string', 'format' => 'date']],
                        ],
                        'responses' => ['200' => ['description' => 'List of work orders']],
                    ],
                ],
                '/customers' => [
                    'get' => [
                        'summary' => 'List customers',
                        'tags' => ['Customers'],
                        'responses' => ['200' => ['description' => 'List of customers']],
                    ],
                ],
                '/stock' => [
                    'get' => [
                        'summary' => 'List stock levels',
                        'tags' => ['Stock'],
                        'responses' => ['200' => ['description' => 'Stock levels']],
                    ],
                ],
            ],
        ];

        return response()->json($spec);
    }
}
