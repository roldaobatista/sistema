<?php

namespace App\Http\Controllers\Concerns;

trait ResolvesCurrentTenant
{
    protected function resolvedTenantId(): int
    {
        $user = request()->user();

        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }
}
