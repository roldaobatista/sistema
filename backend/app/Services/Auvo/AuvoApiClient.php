<?php

namespace App\Services\Auvo;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AuvoApiClient
{
    private const BASE_URL = 'https://api.auvo.com.br/v2';
    private const TOKEN_CACHE_KEY = 'auvo_api_token';
    private const TOKEN_TTL_SECONDS = 1500; // 25min (token lasts 30min per Auvo docs)
    private const MAX_RETRIES = 3;
    private const RETRY_DELAY_MS = 500;
    private const TIMEOUT_SECONDS = 15;
    private const DEFAULT_PAGE_SIZE = 100;
    private const RATE_LIMIT_DELAY_MS = 50; // 400 req/min limit → safe inter-request delay

    private ?string $apiKey;
    private ?string $apiToken;

    public function __construct(?string $apiKey = null, ?string $apiToken = null)
    {
        $this->apiKey = $apiKey ?? config('services.auvo.api_key');
        $this->apiToken = $apiToken ?? config('services.auvo.api_token');
    }

    /**
     * Authenticate and cache the Bearer token.
     */
    public function authenticate(): string
    {
        $cached = Cache::get(self::TOKEN_CACHE_KEY);
        if ($cached) {
            return $cached;
        }

        /** @var Response $response */
        $response = Http::timeout(self::TIMEOUT_SECONDS)
            ->post(self::BASE_URL . '/login/', [
                'apiKey' => $this->apiKey,
                'apiToken' => $this->apiToken,
            ]);

        if ($response->failed()) {
            Log::error('Auvo API authentication failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException('Auvo API authentication failed: ' . $response->status());
        }

        $data = $response->json();
        $token = $data['result']['accessToken'] ?? $data['result']['token'] ?? $data['accessToken'] ?? null;

        if (!$token) {
            throw new \RuntimeException('Auvo API returned no token in response');
        }

        Cache::put(self::TOKEN_CACHE_KEY, $token, self::TOKEN_TTL_SECONDS);

        return $token;
    }

    /**
     * Clear cached token (force re-auth on next call).
     */
    public function clearToken(): void
    {
        Cache::forget(self::TOKEN_CACHE_KEY);
    }

    /**
     * Perform authenticated GET request with retry logic.
     */
    public function get(string $endpoint, array $params = []): ?array
    {
        $token = $this->authenticate();

        /** @var Response $response */
        $response = Http::timeout(self::TIMEOUT_SECONDS)
            ->retry(self::MAX_RETRIES, self::RETRY_DELAY_MS, function (\Exception $exception, $request) {
                // Retry on server errors and rate limits
                if ($exception instanceof \Illuminate\Http\Client\RequestException) {
                    $status = $exception->response?->status();
                    return in_array($status, [403, 429, 500, 502, 503, 504]);
                }
                return true; // retry on connection errors
            })
            ->withToken($token)
            ->get(self::BASE_URL . '/' . ltrim($endpoint, '/'), $params);

        // Token expired — clear and retry once
        if ($response->status() === 401) {
            $this->clearToken();
            $token = $this->authenticate();

            /** @var Response $response */
            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->withToken($token)
                ->get(self::BASE_URL . '/' . ltrim($endpoint, '/'), $params);
        }

        if ($response->failed()) {
            Log::warning('Auvo API GET request failed', [
                'endpoint' => $endpoint,
                'params' => $params,
                'status' => $response->status(),
            ]);
            return null;
        }

        return $response->json();
    }

    /**
     * Fetch all records from a paginated endpoint.
     *
     * @return \Generator<array> Yields individual records
     */
    public function fetchAll(string $endpoint, array $filters = [], int $pageSize = self::DEFAULT_PAGE_SIZE): \Generator
    {
        $page = 1;
        $hasMore = true;

        while ($hasMore) {
            $params = array_merge($filters, [
                'page' => $page,
                'pageSize' => $pageSize,
            ]);

            $response = $this->get($endpoint, $params);

            if (!$response) {
                Log::warning('Auvo API pagination stopped due to empty response', [
                    'endpoint' => $endpoint,
                    'page' => $page,
                ]);
                break;
            }

            // Auvo V2 returns list data inside result.entityList
            $records = $response['result']['entityList']
                ?? $response['result']['list']
                ?? $response['result'] ?? $response['data'] ?? $response ?? [];

            // If result is not a sequential array, stop
            if (!is_array($records) || (isset($records['totalCount']) && !isset($records[0]))) {
                // $records might be {entityList: [], totalCount: X} — no data left
                break;
            }

            if (!is_array($records) || empty($records)) {
                break;
            }

            foreach ($records as $record) {
                yield $record;
            }

            // If we got fewer records than pageSize, we're on the last page
            if (count($records) < $pageSize) {
                $hasMore = false;
            } else {
                $page++;
                // Rate limiting delay between pages
                usleep(self::RATE_LIMIT_DELAY_MS * 1000);
            }
        }
    }

    /**
     * Count total available records for an entity.
     */
    public function count(string $endpoint, array $filters = []): int
    {
        $params = array_merge($filters, ['page' => 1, 'pageSize' => 1]);
        $response = $this->get($endpoint, $params);

        if (!$response) {
            return 0;
        }

        // Auvo V2 returns totalCount inside result object
        return $response['result']['totalCount']
            ?? $response['totalCount']
            ?? $response['result']['total']
            ?? 0;
    }

    /**
     * Test connection by attempting authentication.
     */
    public function testConnection(): array
    {
        try {
            $this->clearToken();
            $this->authenticate();

            return [
                'connected' => true,
                'message' => 'Conexão com a API Auvo estabelecida com sucesso',
            ];
        } catch (\Exception $e) {
            return [
                'connected' => false,
                'message' => 'Falha na conexão: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Check if credentials are configured.
     */
    public function hasCredentials(): bool
    {
        return !empty($this->apiKey) && !empty($this->apiToken);
    }

    /**
     * Get available entity counts for dashboard.
     */
    public function getEntityCounts(): array
    {
        $entities = [
            'customers' => 'customers',
            'equipments' => 'equipments',
            'tasks' => 'tasks',
            'quotations' => 'quotations',
            'expenses' => 'expenses',
            'products' => 'products',
            'services' => 'services',
            'tickets' => 'tickets',
            'users' => 'users',
            'teams' => 'teams',
        ];

        $counts = [];
        foreach ($entities as $key => $endpoint) {
            try {
                $counts[$key] = $this->count($endpoint);
            } catch (\Exception $e) {
                $counts[$key] = -1; // indicates error
                Log::warning("Auvo count failed for {$key}", ['error' => $e->getMessage()]);
            }
        }

        return $counts;
    }

    /**
     * Perform authenticated POST request.
     */
    public function post(string $endpoint, array $data): ?array
    {
        return $this->request('post', $endpoint, $data);
    }

    /**
     * Perform authenticated PUT request.
     */
    public function put(string $endpoint, array $data): ?array
    {
        return $this->request('put', $endpoint, $data);
    }

    /**
     * Perform authenticated PATCH request.
     */
    public function patch(string $endpoint, array $data): ?array
    {
        return $this->request('patch', $endpoint, $data);
    }

    /**
     * Generic authenticated request handler.
     */
    private function request(string $method, string $endpoint, array $data = []): ?array
    {
        $token = $this->authenticate();

        /** @var Response $response */
        $response = Http::timeout(self::TIMEOUT_SECONDS)
            ->withToken($token)
            ->$method(self::BASE_URL . '/' . ltrim($endpoint, '/'), $data);

        // Token expired — clear and retry once
        if ($response->status() === 401) {
            $this->clearToken();
            $token = $this->authenticate();

            /** @var Response $response */
            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->withToken($token)
                ->$method(self::BASE_URL . '/' . ltrim($endpoint, '/'), $data);
        }

        if ($response->failed()) {
            Log::error("Auvo API {$method} request failed", [
                'endpoint' => $endpoint,
                'status' => $response->status(),
                'body' => $response->body(),
                'data' => $data,
            ]);
            throw new \RuntimeException("Auvo API request failed: {$response->status()} - {$response->body()}");
        }

        return $response->json();
    }
}
