<?php

namespace App\Http\Middleware;

use App\Support\ReportExportAuthorization;
use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\Exceptions\PermissionDoesNotExist;
use Symfony\Component\HttpFoundation\Response;

class CheckReportExportPermission
{
    private const ROLE_SUPER_ADMIN = 'super_admin';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Nao autenticado.'], 401);
        }

        if ($user->hasRole(self::ROLE_SUPER_ADMIN)) {
            return $next($request);
        }

        $type = ReportExportAuthorization::normalizeType((string) $request->route('type'));
        $permission = ReportExportAuthorization::permissionForType($type);

        if (!$permission) {
            return response()->json(['message' => 'Tipo de relatorio invalido.'], 422);
        }

        try {
            if (!$user->hasPermissionTo($permission)) {
                return response()->json([
                    'message' => 'Acesso negado. Permissao necessaria: ' . $permission,
                ], 403);
            }
        } catch (PermissionDoesNotExist) {
            return response()->json([
                'message' => 'Acesso negado. Permissao nao configurada: ' . $permission,
            ], 403);
        }

        // Normaliza alias para o controller trabalhar com um tipo canonico.
        if ($route = $request->route()) {
            $route->setParameter('type', $type);
        }

        return $next($request);
    }
}
