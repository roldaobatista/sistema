<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TenantController extends Controller
{
    public function index(): JsonResponse
    {
        $tenants = Tenant::withCount(['users', 'branches'])->orderBy('name')->get();
        return response()->json($tenants);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'document' => [
                'nullable', 'string', 'max:20',
                Rule::unique('tenants', 'document')->whereNotNull('document'),
            ],
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => ['sometimes', Rule::in(array_keys(Tenant::STATUSES))],
        ]);

        try {
            return DB::transaction(function () use ($validated) {
                $tenant = Tenant::create([...$validated, 'status' => $validated['status'] ?? Tenant::STATUS_ACTIVE]);

                AuditLog::log('created', "Empresa {$tenant->name} criada", $tenant);

                return response()->json($tenant->loadCount(['users', 'branches']), 201);
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao criar empresa.'], 500);
        }
    }

    public function show(Tenant $tenant): JsonResponse
    {
        return response()->json(
            $tenant->loadCount(['users', 'branches'])
                ->load(['users:id,name,email', 'branches:id,tenant_id,name,code'])
        );
    }

    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'document' => [
                'nullable', 'string', 'max:20',
                Rule::unique('tenants', 'document')->whereNotNull('document')->ignore($tenant->id),
            ],
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => ['sometimes', Rule::in(array_keys(Tenant::STATUSES))],
        ]);

        try {
            $old = $tenant->toArray();
            $tenant->update($validated);

            $freshTenant = $tenant->fresh();
            AuditLog::log('updated', "Empresa {$freshTenant->name} atualizada", $freshTenant, $old, $freshTenant->toArray());

            return response()->json($freshTenant->loadCount(['users', 'branches']));
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao atualizar empresa.'], 500);
        }
    }

    public function destroy(Tenant $tenant): JsonResponse
    {
        $usersCount = $tenant->users()->count();
        $branchesCount = Branch::withoutGlobalScope('tenant')->where('tenant_id', $tenant->id)->count();

        if ($usersCount > 0 || $branchesCount > 0) {
            $dependencies = [];
            if ($usersCount > 0) $dependencies['users'] = $usersCount;
            if ($branchesCount > 0) $dependencies['branches'] = $branchesCount;

            return response()->json([
                'message' => 'Não é possível excluir empresa com dados vinculados.',
                'dependencies' => $dependencies,
            ], 422);
        }

        try {
            return DB::transaction(function () use ($tenant) {
                AuditLog::log('deleted', "Empresa {$tenant->name} removida", $tenant);
                $tenant->delete();

                return response()->json(null, 204);
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao excluir empresa.'], 500);
        }
    }


    /**
     * Convidar usuário para um tenant
     */
    public function invite(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'role' => [
                'sometimes', 'string', 'max:50',
                Rule::exists('roles', 'name')->where('team_id', $tenant->id),
            ],
        ]);

        try {
            return DB::transaction(function () use ($validated, $tenant) {
                $user = User::where('email', $validated['email'])->first();

                if ($user) {
                    if ($tenant->users()->where('user_id', $user->id)->exists()) {
                        return response()->json(['message' => 'Usuário já pertence a esta empresa.'], 422);
                    }
                    $tenant->users()->attach($user->id, ['is_default' => false]);
                } else {
                    $user = User::create([
                        'name' => $validated['name'],
                        'email' => $validated['email'],
                        'password' => Hash::make(Str::random(32)),
                        'tenant_id' => $tenant->id,
                        'current_tenant_id' => $tenant->id,
                    ]);
                    $tenant->users()->attach($user->id, ['is_default' => true]);
                }

                if (!empty($validated['role'])) {
                    setPermissionsTeamId($tenant->id);
                    $user->assignRole($validated['role']);
                }

                AuditLog::log('created', "Usuário {$user->name} convidado para {$tenant->name}", $user);

                return response()->json(['user' => $user, 'message' => 'Convite realizado'], 201);
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao convidar usuário.'], 500);
        }
    }

    /**
     * Remover usuário de um tenant
     */
    public function removeUser(Tenant $tenant, User $user): JsonResponse
    {
        if (!$tenant->users()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Usuário não pertence a esta empresa.'], 404);
        }

        try {
            return DB::transaction(function () use ($tenant, $user) {
                $tenant->users()->detach($user->id);
                AuditLog::log('deleted', "Usuário {$user->name} removido de {$tenant->name}", $user);
                return response()->json(null, 204);
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao remover usuário.'], 500);
        }
    }

    /**
     * Estatísticas resumidas
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'total' => Tenant::count(),
            'active' => Tenant::where('status', Tenant::STATUS_ACTIVE)->count(),
            'trial' => Tenant::where('status', Tenant::STATUS_TRIAL)->count(),
            'inactive' => Tenant::where('status', Tenant::STATUS_INACTIVE)->count(),
        ]);
    }
}
