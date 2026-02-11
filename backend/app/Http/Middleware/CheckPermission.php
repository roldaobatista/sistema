<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Checks if the authenticated user has the required Spatie permission.
 * Usage in routes: ->middleware('check.permission:os.work_order.view')
 */
class CheckPermission
{
    /** Role que bypassa todas as permissões */
    private const ROLE_SUPER_ADMIN = 'super_admin';

    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Não autenticado.'], 401);
        }

        // super_admin bypasses all permission checks
        if ($user->hasRole(self::ROLE_SUPER_ADMIN)) {
            return $next($request);
        }

        if (!$user->hasPermissionTo($permission)) {
            return response()->json([
                'message' => 'Acesso negado. Permissão necessária: ' . $permission,
            ], 403);
        }

        return $next($request);
    }
}
