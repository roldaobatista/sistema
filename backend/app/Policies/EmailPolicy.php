<?php

namespace App\Policies;

use App\Models\Email;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class EmailPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('email.inbox.view');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Email $email): bool
    {
        // Must belong to same tenant
        if ($user->current_tenant_id !== $email->tenant_id) {
            return false;
        }

        return $user->hasPermissionTo('email.inbox.view');
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->hasPermissionTo('email.inbox.manage');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Email $email): bool
    {
        if ($user->current_tenant_id !== $email->tenant_id) {
            return false;
        }
        return $user->hasPermissionTo('email.inbox.manage');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Email $email): bool
    {
        if ($user->current_tenant_id !== $email->tenant_id) {
            return false;
        }
        return $user->hasPermissionTo('email.inbox.manage');
    }

    /**
     * Determine whether the user can manage the model (assign, snooze, etc).
     */
    public function manage(User $user, Email $email): bool
    {
        if ($user->current_tenant_id !== $email->tenant_id) {
            return false;
        }
        return $user->hasPermissionTo('email.inbox.manage');
    }
}
