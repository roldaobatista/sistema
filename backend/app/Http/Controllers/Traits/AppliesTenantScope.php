<?php

namespace App\Http\Controllers\Traits;

use Illuminate\Http\Request;

/**
 * Aplica o escopo multi-tenant do Spatie Permission.
 * Usado pelos controllers IAM (Role, Permission).
 */
trait AppliesTenantScope
{
    private function applyTenantScope(Request $request): void
    {
        $tenantId = app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($request->user()->current_tenant_id ?? $request->user()->tenant_id);

        setPermissionsTeamId($tenantId);
    }
}
