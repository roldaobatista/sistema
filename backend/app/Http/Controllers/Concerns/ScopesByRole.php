<?php

namespace App\Http\Controllers\Concerns;

/**
 * Roles that see only their own data (scoped).
 * Anyone with ANY role outside this list gets full tenant access.
 */
trait ScopesByRole
{
    protected static array $scopedRoles = ['tecnico', 'tecnico_vendedor', 'motorista'];

    protected function shouldScopeByUser(): bool
    {
        $user = auth()->user();
        if (!$user) {
            return false;
        }

        $roleNames = $user->getRoleNames();
        if ($roleNames->isEmpty()) {
            return false;
        }
        foreach ($roleNames as $roleName) {
            if (!in_array($roleName, self::$scopedRoles, true)) {
                return false;
            }
        }
        return true;
    }
}
