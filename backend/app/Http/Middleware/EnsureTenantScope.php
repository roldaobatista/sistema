<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantScope
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Não autenticado.'], 401);
        }

        $tenantId = $user->current_tenant_id ?? $user->tenant_id;

        if (!$tenantId) {
            return response()->json(['message' => 'Nenhuma empresa selecionada.'], 403);
        }

        // Disponibiliza o tenant_id globalmente
        app()->instance('current_tenant_id', $tenantId);

        // Preserve explicit tenant payload for the tenant switch endpoint.
        if (!$request->is('api/v1/switch-tenant')) {
            $request->merge(['tenant_id' => $tenantId]);
        }

        // FIX-18: Configura escopo Spatie Permission para o tenant atual
        setPermissionsTeamId($tenantId);

        return $next($request);
    }
}
