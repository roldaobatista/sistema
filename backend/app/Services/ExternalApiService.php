<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

abstract class ExternalApiService
{
    protected function fetch(string $url, string $cacheKey, int $cacheTtlSeconds): ?array
    {
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        try {
            $response = Http::timeout(8)->retry(2, 300)->get($url);

            if ($response->failed()) {
                Log::warning('External API request failed', [
                    'url' => $url,
                    'status' => $response->status(),
                ]);
                return null;
            }

            $data = $response->json();

            if ($data !== null) {
                Cache::put($cacheKey, $data, $cacheTtlSeconds);
            }

            return $data;
        } catch (\Exception $e) {
            Log::error('External API request exception', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
