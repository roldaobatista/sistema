<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verifica assinatura do webhook via token compartilhado.
 * Aceita: header X-Webhook-Secret ou query ?token=
 */
class VerifyWebhookSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = config('services.webhook_secret');

        if (!$expected) {
            // Se não há segredo configurado, aceita (dev)
            return $next($request);
        }

        $token = $request->header('X-Webhook-Secret')
              ?? $request->query('token');

        if (!$token || !hash_equals($expected, $token)) {
            return response()->json(['message' => 'Invalid webhook signature'], 403);
        }

        return $next($request);
    }
}
