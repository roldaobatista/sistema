<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

abstract class ExternalApiService
{
    protected function fetch(string $url, string $cacheKey, int $cacheTtlSeconds): ?array
    {
        return Cache::remember($cacheKey, $cacheTtlSeconds, function () use ($url, $cacheKey) {
            try {
                $response = Http::timeout(5)->retry(2, 200)->get($url);

                if ($response->failed()) {
                    Log::warning('External API request failed', [
                        'url' => $url,
                        'status' => $response->status(),
                    ]);
                    return null;
                }

                return $response->json();
            } catch (\Exception $e) {
                Log::error('External API request exception', [
                    'url' => $url,
                    'error' => $e->getMessage(),
                ]);
                return null;
            }
        });
    }
}
