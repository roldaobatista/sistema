<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
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

        $tenant = Tenant::find($tenantId);
        if ($tenant && $tenant->isInactive()) {
            if (!$request->is('api/v1/switch-tenant') && !$request->is('api/v1/my-tenants') && !$request->is('api/v1/me') && !$request->is('api/v1/logout')) {
                return response()->json([
                    'message' => 'A empresa atual está inativa. Selecione outra empresa.',
                    'tenant_inactive' => true,
                ], 403);
            }
        }

        app()->instance('current_tenant_id', $tenantId);

        if (!$request->is('api/v1/switch-tenant')) {
            $request->merge(['tenant_id' => $tenantId]);
        }

        setPermissionsTeamId($tenantId);

        return $next($request);
    }
}
