<?php

namespace App\Services\Auvo;

use App\Models\TenantSetting;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AuvoApiClient
{
    private const BASE_URL = 'https://api.auvo.com.br/v2';
    private const TOKEN_TTL_SECONDS = 1500;
    private const MAX_RETRIES = 3;
    private const RETRY_DELAY_MS = 500;
    private const TIMEOUT_SECONDS = 30;
    private const DEFAULT_PAGE_SIZE = 100;
    private const RATE_LIMIT_DELAY_MS = 150;

    private string $apiKey;
    private string $apiToken;
    private ?int $tenantId;

    public function __construct(string $apiKey, string $apiToken, ?int $tenantId = null)
    {
        $this->apiKey = $apiKey;
        $this->apiToken = $apiToken;
        $this->tenantId = $tenantId;
    }

    /**
     * Create a client from tenant DB settings, with fallback to .env config.
     */
    public static function forTenant(int $tenantId): self
    {
        $credentials = TenantSetting::getValue($tenantId, 'auvo_credentials');

        $apiKey = $credentials['api_key'] ?? config('services.auvo.api_key', '');
        $apiToken = $credentials['api_token'] ?? config('services.auvo.api_token', '');

        return new self($apiKey, $apiToken, $tenantId);
    }

    /**
     * Create from raw config (for when credentials are passed explicitly).
     */
    public static function fromConfig(): self
    {
        return new self(
            config('services.auvo.api_key', ''),
            config('services.auvo.api_token', ''),
        );
    }

    public function hasCredentials(): bool
    {
        return !empty($this->apiKey) && !empty($this->apiToken);
    }

    private function tokenCacheKey(): string
    {
        $suffix = $this->tenantId ? "_{$this->tenantId}" : '_global';
        return 'auvo_api_token' . $suffix;
    }

    /**
     * Authenticate and cache the Bearer token.
     */
    public function authenticate(): string
    {
        $cacheKey = $this->tokenCacheKey();
        $cached = Cache::get($cacheKey);
        if ($cached) {
            return $cached;
        }

        Log::info('Auvo: authenticating', ['tenant' => $this->tenantId]);

        $response = Http::timeout(self::TIMEOUT_SECONDS)
            ->post(self::BASE_URL . '/login/', [
                'apiKey' => $this->apiKey,
                'apiToken' => $this->apiToken,
            ]);

        if ($response->failed()) {
            $body = $response->body();
            $status = $response->status();
            Log::error('Auvo: authentication failed', compact('status', 'body'));
            throw new \RuntimeException("Auvo: autenticação falhou (HTTP {$status}). Verifique suas credenciais.");
        }

        $data = $response->json();

        // Auvo V2 may return token in different paths
        $token = $data['result']['accessToken']
            ?? $data['result']['token']
            ?? $data['accessToken']
            ?? $data['token']
            ?? null;

        if (!$token) {
            Log::error('Auvo: no token in response', ['response' => $data]);
            throw new \RuntimeException('Auvo: resposta de login não contém token. Verifique suas credenciais.');
        }

        Cache::put($cacheKey, $token, self::TOKEN_TTL_SECONDS);

        Log::info('Auvo: authenticated successfully', ['tenant' => $this->tenantId]);

        return $token;
    }

    public function clearToken(): void
    {
        Cache::forget($this->tokenCacheKey());
    }

    /**
     * Perform authenticated GET request with retry logic.
     * @param int|null $timeoutSeconds Override default timeout (avoids gateway 504 when fetching counts).
     */
    public function get(string $endpoint, array $params = [], ?int $timeoutSeconds = null): ?array
    {
        $url = self::BASE_URL . '/' . ltrim($endpoint, '/');

        $response = $this->authenticatedRequest('get', $url, $params, $timeoutSeconds);

        if (!$response || $response->failed()) {
            Log::warning('Auvo: GET failed', [
                'endpoint' => $endpoint,
                'status' => $response?->status(),
                'body' => $response?->body(),
            ]);
            return null;
        }

        return $response->json();
    }

    /**
     * Fetch all records from a paginated endpoint using a generator.
     *
     * @return \Generator<array>
     */
    public function fetchAll(string $endpoint, array $filters = [], int $pageSize = self::DEFAULT_PAGE_SIZE): \Generator
    {
        $page = 1;

        while (true) {
            $params = array_merge($filters, [
                'page' => $page,
                'pageSize' => $pageSize,
            ]);

            $response = $this->get($endpoint, $params);

            if (!$response) {
                Log::warning('Auvo: pagination stopped - empty response', compact('endpoint', 'page'));
                break;
            }

            $records = $this->extractRecords($response);

            if (empty($records)) {
                if ($page === 1) {
                    Log::info('Auvo: first page empty', [
                        'endpoint' => $endpoint,
                        'response_keys' => array_keys($response),
                        'result_keys' => isset($response['result']) && is_array($response['result'])
                            ? array_keys($response['result'])
                            : null,
                    ]);
                }
                break;
            }

            foreach ($records as $record) {
                if (is_array($record)) {
                    yield $record;
                }
            }

            if (count($records) < $pageSize) {
                break;
            }

            $page++;
            usleep(self::RATE_LIMIT_DELAY_MS * 1000);
        }
    }

    /**
     * Count total available records for an entity.
     * @param int|null $timeoutSeconds Shorter timeout for status/counts (e.g. 6) to avoid gateway 504.
     */
    public function count(string $endpoint, array $filters = [], ?int $timeoutSeconds = null): int
    {
        $params = array_merge($filters, ['page' => 1, 'pageSize' => 1]);
        $response = $this->get($endpoint, $params, $timeoutSeconds);

        if (!$response) {
            return 0;
        }

        return $response['result']['totalCount']
            ?? $response['result']['total']
            ?? $response['totalCount']
            ?? 0;
    }

    /**
     * Test connection by attempting authentication.
     */
    public function testConnection(): array
    {
        if (!$this->hasCredentials()) {
            return [
                'connected' => false,
                'message' => 'Credenciais não configuradas. Informe API Key e API Token.',
            ];
        }

        try {
            $this->clearToken();
            $this->authenticate();

            return [
                'connected' => true,
                'message' => 'Conexão com a API Auvo estabelecida com sucesso.',
            ];
        } catch (\Exception $e) {
            return [
                'connected' => false,
                'message' => 'Falha na conexão: ' . $e->getMessage(),
            ];
        }
    }

    /** Timeout per entity when fetching counts (avoids gateway 504). */
    private const COUNTS_TIMEOUT_SECONDS = 6;

    /**
     * Get available entity counts for dashboard.
     * Uses a short timeout per entity so the status endpoint does not trigger gateway timeout (504).
     */
    public function getEntityCounts(): array
    {
        $entities = [
            'customers' => 'customers',
            'segments' => 'segments',
            'customer_groups' => 'customerGroups',
            'equipments' => 'equipments',
            'tasks' => 'tasks',
            'products' => 'products',
            'services' => 'services',
        ];

        $counts = [];
        foreach ($entities as $key => $endpoint) {
            try {
                $counts[$key] = $this->count($endpoint, [], self::COUNTS_TIMEOUT_SECONDS);
            } catch (\Exception $e) {
                $counts[$key] = -1;
                Log::warning("Auvo: count failed for {$key}", ['error' => $e->getMessage()]);
            }
        }

        return $counts;
    }

    /**
     * Perform authenticated POST request.
     */
    public function post(string $endpoint, array $data): ?array
    {
        return $this->mutatingRequest('post', $endpoint, $data);
    }

    /**
     * Perform authenticated PUT request.
     */
    public function put(string $endpoint, array $data): ?array
    {
        return $this->mutatingRequest('put', $endpoint, $data);
    }

    /**
     * Perform authenticated PATCH request.
     */
    public function patch(string $endpoint, array $data): ?array
    {
        return $this->mutatingRequest('patch', $endpoint, $data);
    }

    // ─── Internal ────────────────────────────────────────────

    /**
     * Extract the list of records from an Auvo API response.
     * Suporta variações: entityList, list, customerList, customers, data, result (array).
     */
    private function extractRecords(array $response): array
    {
        $result = $response['result'] ?? null;

        if (is_array($result)) {
            foreach (['entityList', 'list', 'customerList', 'customers', 'data', 'items', 'results'] as $key) {
                if (isset($result[$key]) && is_array($result[$key]) && array_is_list($result[$key])) {
                    return $result[$key];
                }
            }
            if (array_is_list($result)) {
                return $result;
            }
        }

        if (isset($response['data']) && is_array($response['data']) && array_is_list($response['data'])) {
            return $response['data'];
        }

        return [];
    }

    /**
     * Perform an authenticated HTTP request with retry on 401 (token expired).
     * @param int|null $timeoutSeconds Override default timeout.
     */
    private function authenticatedRequest(string $method, string $url, array $params = [], ?int $timeoutSeconds = null): ?Response
    {
        $token = $this->authenticate();
        $timeout = $timeoutSeconds ?? self::TIMEOUT_SECONDS;

        try {
            /** @var Response $response */
            $response = Http::timeout($timeout)
                ->retry(self::MAX_RETRIES, self::RETRY_DELAY_MS, function (\Exception $exception) {
                    if ($exception instanceof \Illuminate\Http\Client\RequestException) {
                        $status = $exception->response?->status();
                        return in_array($status, [429, 500, 502, 503, 504]);
                    }
                    return true;
                }, throw: false)
                ->withToken($token)
                ->get($url, $params);
        } catch (\Exception $e) {
            Log::warning('Auvo: request exception', ['url' => $url, 'error' => $e->getMessage()]);
            return null;
        }

        // Token expired — re-auth and retry once
        if ($response->status() === 401) {
            $this->clearToken();
            $token = $this->authenticate();

            try {
                $response = Http::timeout(self::TIMEOUT_SECONDS)
                    ->withToken($token)
                    ->get($url, $params);
            } catch (\Exception $e) {
                Log::warning('Auvo: retry after 401 failed', ['url' => $url, 'error' => $e->getMessage()]);
                return null;
            }
        }

        return $response;
    }

    /**
     * Mutating request (POST/PUT/PATCH) with retry on 401.
     */
    private function mutatingRequest(string $method, string $endpoint, array $data): ?array
    {
        $token = $this->authenticate();
        $url = self::BASE_URL . '/' . ltrim($endpoint, '/');

        /** @var Response $response */
        $response = Http::timeout(self::TIMEOUT_SECONDS)
            ->withToken($token)
            ->$method($url, $data);

        if ($response->status() === 401) {
            $this->clearToken();
            $token = $this->authenticate();

            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->withToken($token)
                ->$method($url, $data);
        }

        if ($response->failed()) {
            Log::error("Auvo: {$method} failed", [
                'endpoint' => $endpoint,
                'status' => $response->status(),
                'body' => $response->body(),
                'data' => $data,
            ]);
            throw new \RuntimeException("Auvo API: {$method} {$endpoint} falhou (HTTP {$response->status()})");
        }

        return $response->json();
    }
}
