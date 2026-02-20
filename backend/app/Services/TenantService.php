<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class TenantService
{
    /**
     * Listar tenants com filtros.
     */
    public function list(array $filters = [], int $perPage = 50)
    {
        $query = Tenant::withCount(['users', 'branches'])->orderBy('name');

        if (!empty($filters['search'])) {
            $term = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('document', 'like', $term)
                  ->orWhere('email', 'like', $term);
            });
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->paginate(min($perPage, 100));
    }

    /**
     * Criar novo tenant.
     */
    public function create(array $data): Tenant
    {
        return DB::transaction(function () use ($data) {
            $tenant = Tenant::create(array_merge($data, [
                'status' => $data['status'] ?? Tenant::STATUS_ACTIVE,
            ]));

            AuditLog::log('created', "Empresa {$tenant->name} criada", $tenant);

            return $tenant;
        });
    }

    /**
     * Atualizar tenant existente.
     */
    public function update(Tenant $tenant, array $data): Tenant
    {
        return DB::transaction(function () use ($tenant, $data) {
            $old = $tenant->toArray();
            $tenant->update($data);

            $freshTenant = $tenant->fresh();
            AuditLog::log('updated', "Empresa {$freshTenant->name} atualizada", $freshTenant, $old, $freshTenant->toArray());

            return $freshTenant;
        });
    }

    /**
     * Excluir tenant se não houver dependências bloqueantes.
     * Retorna array de dependências se não puder excluir, ou true se excluiu.
     */
    public function delete(Tenant $tenant): bool|array
    {
        $dependencies = $this->checkDependencies($tenant);

        if (!empty($dependencies)) {
            return $dependencies;
        }

        return DB::transaction(function () use ($tenant) {
            AuditLog::log('deleted', "Empresa {$tenant->name} removida", $tenant);
            $tenant->delete();

            return true;
        });
    }

    /**
     * Verificar dependências antes da exclusão.
     */
    public function checkDependencies(Tenant $tenant): array
    {
        $dependencies = [];

        $usersCount = $tenant->users()->count();
        if ($usersCount > 0) $dependencies['users'] = $usersCount;

        $branchesCount = Branch::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->count();
        if ($branchesCount > 0) $dependencies['branches'] = $branchesCount;

        $dependentTables = [
            'work_orders' => \App\Models\WorkOrder::class,
            'customers' => \App\Models\Customer::class,
            'quotes' => \App\Models\Quote::class,
            'products' => \App\Models\Product::class,
        ];

        foreach ($dependentTables as $label => $modelClass) {
            if (class_exists($modelClass)) {
                $count = $modelClass::withoutGlobalScope('tenant')
                    ->where('tenant_id', $tenant->id)
                    ->count();
                if ($count > 0) $dependencies[$label] = $count;
            }
        }

        return $dependencies;
    }

    /**
     * Convidar usuário para o tenant.
     */
    public function inviteUser(Tenant $tenant, array $data): array
    {
        return DB::transaction(function () use ($tenant, $data) {
            $user = User::where('email', $data['email'])->first();
            $isNewUser = false;

            if ($user) {
                if ($tenant->users()->where('user_id', $user->id)->exists()) {
                    throw ValidationException::withMessages(['email' => 'Usuário já pertence a esta empresa.']);
                }
                $tenant->users()->attach($user->id, ['is_default' => false]);
            } else {
                $isNewUser = true;
                $user = User::create([
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'password' => Hash::make(Str::random(32)),
                    'tenant_id' => $tenant->id,
                    'current_tenant_id' => $tenant->id,
                ]);
                $tenant->users()->attach($user->id, ['is_default' => true]);
            }

            if (!empty($data['role'])) {
                $this->assignRoleToUser($tenant, $user, $data['role']);
            }

            if ($isNewUser) {
                $this->sendPasswordReset($user);
            }

            AuditLog::log('created', "Usuário {$user->name} convidado para {$tenant->name}", $user);

            return [
                'user' => $user,
                'is_new' => $isNewUser,
            ];
        });
    }

    /**
     * Remover usuário do tenant.
     */
    public function removeUser(Tenant $tenant, User $user, User $actor): void
    {
        if ($user->id === $actor->id) {
            throw ValidationException::withMessages(['user' => 'Você não pode remover a si mesmo da empresa.']);
        }

        if (!$tenant->users()->where('user_id', $user->id)->exists()) {
            throw new \Exception('Usuário não pertence a esta empresa.', 404);
        }

        $usersCount = $tenant->users()->count();
        if ($usersCount <= 1) {
            throw ValidationException::withMessages(['user' => 'Não é possível remover o último usuário da empresa. A empresa ficaria sem acesso.']);
        }

        DB::transaction(function () use ($tenant, $user) {
            $tenant->users()->detach($user->id);

            if ($user->current_tenant_id === $tenant->id) {
                $nextTenant = $user->tenants()->first();
                $user->update([
                    'current_tenant_id' => $nextTenant?->id ?? $user->tenant_id,
                ]);
            }

            AuditLog::log('deleted', "Usuário {$user->name} removido de {$tenant->name}", $user);
        });
    }

    protected function assignRoleToUser(Tenant $tenant, User $user, string $roleName): void
    {
        $roleExists = Role::where('name', $roleName)
            ->where(function ($q) use ($tenant) {
                $q->where('team_id', $tenant->id)->orWhereNull('team_id');
            })
            ->where('guard_name', 'api')
            ->exists();

        if (!$roleExists) {
            throw ValidationException::withMessages(['role' => 'Role informada não existe ou não é válida para esta empresa.']);
        }

        setPermissionsTeamId($tenant->id);
        $user->assignRole($roleName);
    }

    protected function sendPasswordReset(User $user): void
    {
        $token = Password::broker()->createToken($user);
        try {
            $user->sendPasswordResetNotification($token);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
