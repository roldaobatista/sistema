<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\Exceptions\PermissionDoesNotExist;
use App\Models\Role;
use Symfony\Component\HttpFoundation\Response;

/**
 * Checks if the authenticated user has the required Spatie permission.
 * Usage in routes: ->middleware('check.permission:os.work_order.view')
 */
class CheckPermission
{

    public function handle(Request $request, Closure $next, string $permissionExpression): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Nao autenticado.'], 401);
        }

        // super_admin bypasses all permission checks
        if ($user->hasRole(Role::SUPER_ADMIN)) {
            return $next($request);
        }

        $permissions = array_values(array_filter(array_map(
            static fn (string $item) => trim($item),
            explode('|', $permissionExpression)
        )));

        if (empty($permissions)) {
            return response()->json([
                'message' => 'Acesso negado. Permissao nao configurada.',
            ], 403);
        }

        $hasAnyPermission = false;
        $hasKnownPermission = false;
        $deniedList = $user->getDeniedPermissionsList();

        foreach ($permissions as $permission) {
            try {
                if (in_array($permission, $deniedList, true)) {
                    $hasKnownPermission = true;
                    continue;
                }
                if ($user->hasPermissionTo($permission)) {
                    $hasAnyPermission = true;
                    break;
                }
                $hasKnownPermission = true;
            } catch (PermissionDoesNotExist) {
                continue;
            }
        }

        if (!$hasAnyPermission) {
            $message = $hasKnownPermission
                ? 'Acesso negado. Permissao necessaria: ' . implode(' | ', $permissions)
                : 'Acesso negado. Permissao nao configurada: ' . implode(' | ', $permissions);

            return response()->json([
                'message' => $message,
            ], 403);
        }

        return $next($request);
    }
}
