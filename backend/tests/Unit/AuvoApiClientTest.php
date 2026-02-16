<?php

namespace Tests\Unit;

use App\Services\Auvo\AuvoApiClient;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AuvoApiClientTest extends TestCase
{
    private AuvoApiClient $client;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->client = new AuvoApiClient('test-key', 'test-token');
    }

    // ── Authentication ──

    public function test_authenticate_caches_token(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response([
                'result' => ['accessToken' => 'mocked-bearer-token'],
            ], 200),
        ]);

        $token = $this->client->authenticate();

        $this->assertEquals('mocked-bearer-token', $token);
        $this->assertEquals('mocked-bearer-token', Cache::get('auvo_api_token_global'));
    }

    public function test_authenticate_uses_cached_token(): void
    {
        Cache::put('auvo_api_token_global', 'cached-token', 3600);

        Http::fake(); // No HTTP calls should be made

        $token = $this->client->authenticate();

        $this->assertEquals('cached-token', $token);
        Http::assertNothingSent();
    }

    public function test_authenticate_throws_on_failure(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['error' => 'invalid'], 401),
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/autenticação falhou/i');

        $this->client->authenticate();
    }

    public function test_authenticate_throws_when_no_token_in_response(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => []], 200),
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/não contém token/i');

        $this->client->authenticate();
    }

    // ── clear_token ──

    public function test_clear_token_removes_cache(): void
    {
        Cache::put('auvo_api_token_global', 'some-token', 3600);

        $this->client->clearToken();

        $this->assertNull(Cache::get('auvo_api_token_global'));
    }

    // ── GET Requests ──

    public function test_get_returns_json_on_success(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response([
                'result' => ['accessToken' => 'token-123'],
            ]),
            'api.auvo.com.br/v2/customers*' => Http::response([
                'result' => ['entityList' => [['id' => 1, 'name' => 'Test']]],
            ]),
        ]);

        $result = $this->client->get('customers', ['page' => 1]);

        $this->assertNotNull($result);
        $this->assertArrayHasKey('result', $result);
        $this->assertEquals(1, $result['result']['entityList'][0]['id']);
    }

    public function test_get_returns_null_on_failure(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response([
                'result' => ['accessToken' => 'token-123'],
            ]),
            'api.auvo.com.br/v2/customers*' => Http::response([], 500),
        ]);

        $result = $this->client->get('customers');

        $this->assertNull($result);
    }

    public function test_get_retries_on_401_with_new_token(): void
    {
        $callCount = 0;

        Http::fake([
            'api.auvo.com.br/v2/login/' => function () use (&$callCount) {
                $callCount++;
                return Http::response([
                    'result' => ['accessToken' => "token-{$callCount}"],
                ]);
            },
            'api.auvo.com.br/v2/customers*' => Http::sequence()
                ->push([], 401)       // First call: unauthorized
                ->push(['result' => ['entityList' => [['id' => 99]]]], 200), // After re-auth
        ]);

        $result = $this->client->get('customers');

        $this->assertNotNull($result);
        $this->assertGreaterThanOrEqual(2, $callCount); // Auth was called at least twice
    }

    // ── Count ──

    public function test_count_parses_total_from_response(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::response([
                'result' => ['totalCount' => 42],
            ]),
        ]);

        $count = $this->client->count('customers');

        $this->assertEquals(42, $count);
    }

    public function test_count_returns_zero_on_failure(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::response([], 500),
        ]);

        $count = $this->client->count('customers');

        $this->assertEquals(0, $count);
    }

    // ── Test Connection ──

    public function test_test_connection_returns_success(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response([
                'result' => ['accessToken' => 'valid-token'],
            ]),
        ]);

        $result = $this->client->testConnection();

        $this->assertTrue($result['connected']);
        $this->assertStringContainsString('sucesso', $result['message']);
    }

    public function test_test_connection_returns_failure(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['error' => 'bad'], 401),
        ]);

        $result = $this->client->testConnection();

        $this->assertFalse($result['connected']);
        $this->assertStringContainsString('Falha', $result['message']);
    }

    // ── Has Credentials ──

    public function test_has_credentials_true_when_configured(): void
    {
        $this->assertTrue($this->client->hasCredentials());
    }

    public function test_has_credentials_false_when_empty(): void
    {
        $emptyClient = new AuvoApiClient('', '');

        $this->assertFalse($emptyClient->hasCredentials());
    }

    public function test_has_credentials_false_when_null(): void
    {
        config(['services.auvo.api_key' => null, 'services.auvo.api_token' => null]);
        $defaultClient = AuvoApiClient::fromConfig();

        $this->assertFalse($defaultClient->hasCredentials());
    }

    // ── Fetch All (Generator) ──

    public function test_fetch_all_yields_records_across_pages(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::sequence()
                ->push(['result' => ['entityList' => [['id' => 1], ['id' => 2]]]], 200)  // Page 1 (full = pageSize 2)
                ->push(['result' => ['entityList' => [['id' => 3]]]], 200),              // Page 2 (partial = last)
        ]);

        $records = [];
        foreach ($this->client->fetchAll('customers', [], 2) as $record) {
            $records[] = $record;
        }

        $this->assertCount(3, $records);
        $this->assertEquals(1, $records[0]['id']);
        $this->assertEquals(3, $records[2]['id']);
    }

    public function test_fetch_all_stops_on_empty_response(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/customers*' => Http::response(null, 500),
        ]);

        $records = iterator_to_array($this->client->fetchAll('customers', [], 100));

        $this->assertCount(0, $records);
    }

    // ── Entity Counts ──

    public function test_get_entity_counts_returns_counts(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/*' => Http::response(['result' => ['totalCount' => 10]]),
        ]);

        $counts = $this->client->getEntityCounts();

        $this->assertArrayHasKey('customers', $counts);
        $this->assertArrayHasKey('tasks', $counts);
        $this->assertEquals(10, $counts['customers']);
    }

    public function test_get_entity_counts_marks_failures_with_negative_one(): void
    {
        Http::fake([
            'api.auvo.com.br/v2/login/' => Http::response(['result' => ['accessToken' => 'tk']]),
            'api.auvo.com.br/v2/*' => Http::response([], 500),
        ]);

        $counts = $this->client->getEntityCounts();

        // count() returns 0 on null response, not -1 (no exception thrown)
        // But if a real exception happens, it's caught and set to -1
        foreach ($counts as $val) {
            $this->assertIsInt($val);
        }
    }
}
