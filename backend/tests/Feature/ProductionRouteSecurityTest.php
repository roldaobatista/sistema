<?php

namespace Tests\Feature;

use Illuminate\Routing\Route as LaravelRoute;
use Tests\TestCase;

class ProductionRouteSecurityTest extends TestCase
{
    public function test_all_v1_routes_except_logins_require_sanctum_authentication(): void
    {
        $publicUris = [
            'api/v1/login',
            'api/v1/portal/login',
        ];

        $violations = collect(app('router')->getRoutes()->getRoutes())
            ->filter(fn (LaravelRoute $route) => str_starts_with($route->uri(), 'api/v1/'))
            ->reject(fn (LaravelRoute $route) => in_array($route->uri(), $publicUris, true))
            ->filter(function (LaravelRoute $route): bool {
                $middleware = $route->gatherMiddleware();

                return ! collect($middleware)->contains(
                    fn (string $item) => str_contains($item, 'auth:sanctum') || str_contains($item, 'Authenticate:sanctum')
                );
            })
            ->map(fn (LaravelRoute $route) => $route->methods()[0] . ' ' . $route->uri())
            ->values();

        $this->assertCount(
            0,
            $violations,
            'Rotas api/v1 sem auth:sanctum: ' . $violations->implode(', ')
        );
    }

    public function test_critical_advanced_groups_have_permission_middleware(): void
    {
        $criticalPrefixes = [
            'api/v1/security/',
            'api/v1/integrations/',
            'api/v1/mobile/',
            'api/v1/fleet-advanced/',
            'api/v1/hr-advanced/',
            'api/v1/innovation/',
        ];

        $violations = collect(app('router')->getRoutes()->getRoutes())
            ->filter(function (LaravelRoute $route) use ($criticalPrefixes): bool {
                foreach ($criticalPrefixes as $prefix) {
                    if (str_starts_with($route->uri(), $prefix)) {
                        return true;
                    }
                }

                return false;
            })
            ->filter(function (LaravelRoute $route): bool {
                $middleware = $route->gatherMiddleware();

                return ! collect($middleware)->contains(
                    fn (string $item) => str_contains($item, 'check.permission:') || str_contains($item, 'CheckPermission')
                );
            })
            ->map(fn (LaravelRoute $route) => $route->methods()[0] . ' ' . $route->uri())
            ->values();

        $this->assertCount(
            0,
            $violations,
            'Rotas críticas sem check.permission: ' . $violations->implode(', ')
        );
    }

    public function test_public_endpoints_have_throttle_rate_limit(): void
    {
        $expectedThrottled = [
            ['method' => 'POST', 'uri' => 'api/v1/login'],
            ['method' => 'POST', 'uri' => 'api/v1/portal/login'],
            ['method' => 'POST', 'uri' => 'api/rate/{token}'],
            ['method' => 'GET', 'uri' => 'api/quotes/{quote}/public-view'],
            ['method' => 'POST', 'uri' => 'api/quotes/{quote}/public-approve'],
            ['method' => 'GET', 'uri' => 'api/pixel/{trackingId}'],
            ['method' => 'POST', 'uri' => 'api/webhooks/whatsapp'],
            ['method' => 'POST', 'uri' => 'api/webhooks/email'],
        ];

        foreach ($expectedThrottled as $routeCheck) {
            $route = collect(app('router')->getRoutes()->getRoutes())->first(function (LaravelRoute $route) use ($routeCheck): bool {
                return $route->uri() === $routeCheck['uri']
                    && in_array($routeCheck['method'], $route->methods(), true);
            });

            $this->assertNotNull($route, "Rota não encontrada: {$routeCheck['method']} {$routeCheck['uri']}");

            $middleware = $route->gatherMiddleware();
            $hasThrottle = collect($middleware)->contains(
                fn (string $item) => str_contains($item, 'throttle:') || str_contains($item, 'ThrottleRequests')
            );

            $this->assertTrue(
                $hasThrottle,
                "Rota pública sem throttle: {$routeCheck['method']} {$routeCheck['uri']}"
            );
        }
    }
}

