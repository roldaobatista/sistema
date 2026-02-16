<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\ThrottleRequestsException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        channels: __DIR__.'/../routes/channels.php',
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Confiar em proxies (Nginx container)
        $middleware->trustProxies(at: '*');

        // Rate limiting global para rotas de API (60 req/min por usuário autenticado)
        $middleware->throttleApi();

        $middleware->alias([
            'tenant.scope' => \App\Http\Middleware\EnsureTenantScope::class,
            'check.tenant' => \App\Http\Middleware\EnsureTenantScope::class,
            'check.permission' => \App\Http\Middleware\CheckPermission::class,
            'check.report.export' => \App\Http\Middleware\CheckReportExportPermission::class,
            'verify.webhook' => \App\Http\Middleware\VerifyWebhookSignature::class,
        ]);

        // Token-based auth only (Bearer) — statefulApi() removed to avoid CSRF 419 on API routes
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Não autenticado.'], 401);
            }
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }
        });

        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $model = class_basename($e->getModel());
                return response()->json([
                    'message' => "Recurso {$model} não encontrado.",
                ], 404);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Rota não encontrada.'], 404);
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'Dados inválidos.',
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'Muitas requisições. Tente novamente em instantes.',
                ], 429);
            }
        });

        $exceptions->render(function (\Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $isProduction = app()->environment('production');
                return response()->json([
                    'message' => $isProduction ? 'Erro interno do servidor.' : $e->getMessage(),
                    ...($isProduction ? [] : [
                        'exception' => get_class($e),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                    ]),
                ], 500);
            }
        });
    })->create();
