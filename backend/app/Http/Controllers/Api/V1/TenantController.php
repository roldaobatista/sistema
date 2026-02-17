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
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class TenantController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Tenant::withCount(['users', 'branches'])->orderBy('name');

            if ($request->filled('search')) {
                $term = '%' . $request->search . '%';
                $query->where(function ($q) use ($term) {
                    $q->where('name', 'like', $term)
                      ->orWhere('document', 'like', $term)
                      ->orWhere('email', 'like', $term);
                });
            }

            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            $perPage = min((int) ($request->per_page ?? 50), 100);
            $tenants = $query->paginate($perPage);

            return response()->json($tenants);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao listar empresas.'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'document' => [
                'nullable', 'string', 'max:20',
                Rule::unique('tenants', 'document')->whereNotNull('document'),
                'regex:/^(\d{11}|\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})$/',
            ],
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => ['sometimes', Rule::in(array_keys(Tenant::STATUSES))],
            'trade_name' => 'nullable|string|max:255',
            'address_street' => 'nullable|string|max:255',
            'address_number' => 'nullable|string|max:20',
            'address_complement' => 'nullable|string|max:100',
            'address_neighborhood' => 'nullable|string|max:100',
            'address_city' => 'nullable|string|max:100',
            'address_state' => 'nullable|string|max:2',
            'address_zip' => 'nullable|string|max:10',
            'website' => 'nullable|url|max:255',
            'state_registration' => 'nullable|string|max:30',
            'city_registration' => 'nullable|string|max:30',
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
        try {
            $tenant->loadCount(['users', 'branches'])
                ->load(['users:id,name,email', 'branches:id,tenant_id,name,code']);

            $data = $tenant->toArray();
            $data['full_address'] = $tenant->full_address;

            return response()->json($data);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao carregar dados da empresa.'], 500);
        }
    }

    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'document' => [
                'nullable', 'string', 'max:20',
                Rule::unique('tenants', 'document')->whereNotNull('document')->ignore($tenant->id),
                'regex:/^(\d{11}|\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})$/',
            ],
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => ['sometimes', Rule::in(array_keys(Tenant::STATUSES))],
            'trade_name' => 'nullable|string|max:255',
            'address_street' => 'nullable|string|max:255',
            'address_number' => 'nullable|string|max:20',
            'address_complement' => 'nullable|string|max:100',
            'address_neighborhood' => 'nullable|string|max:100',
            'address_city' => 'nullable|string|max:100',
            'address_state' => 'nullable|string|max:2',
            'address_zip' => 'nullable|string|max:10',
            'website' => 'nullable|url|max:255',
            'state_registration' => 'nullable|string|max:30',
            'city_registration' => 'nullable|string|max:30',
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

        if (!empty($dependencies)) {
            return response()->json([
                'message' => 'Não é possível excluir empresa com dados vinculados.',
                'dependencies' => $dependencies,
            ], 409);
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
     * Convidar usuário para um tenant.
     * Se o usuário já existe, vincula ao tenant.
     * Se não existe, cria com senha temporária e envia link de reset.
     */
    public function invite(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'role' => 'nullable|string|max:50',
        ]);

        try {
            return DB::transaction(function () use ($validated, $tenant) {
                $user = User::where('email', $validated['email'])->first();
                $isNewUser = false;

                if ($user) {
                    if ($tenant->users()->where('user_id', $user->id)->exists()) {
                        return response()->json(['message' => 'Usuário já pertence a esta empresa.'], 422);
                    }
                    $tenant->users()->attach($user->id, ['is_default' => false]);
                } else {
                    $isNewUser = true;
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
                    $roleExists = Role::where('name', $validated['role'])
                        ->where(function ($q) use ($tenant) {
                            $q->where('team_id', $tenant->id)->orWhereNull('team_id');
                        })->exists();

                    if (!$roleExists) {
                        return response()->json([
                            'message' => 'Role informada não existe.',
                            'errors' => ['role' => ['A role informada não é válida para esta empresa.']],
                        ], 422);
                    }

                    setPermissionsTeamId($tenant->id);
                    $user->assignRole($validated['role']);
                }

                if ($isNewUser) {
                    $token = Password::broker()->createToken($user);
                    try {
                        $user->sendPasswordResetNotification($token);
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }

                AuditLog::log('created', "Usuário {$user->name} convidado para {$tenant->name}", $user);

                return response()->json([
                    'user' => $user,
                    'message' => $isNewUser
                        ? 'Usuário criado e notificação de definição de senha enviada.'
                        : 'Usuário existente vinculado à empresa.',
                ], 201);
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao convidar usuário.'], 500);
        }
    }

    /**
     * Remover usuário de um tenant.
     * Impede remoção do último usuário para evitar tenant órfão.
     */
    public function removeUser(Tenant $tenant, User $user): JsonResponse
    {
        if (!$tenant->users()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Usuário não pertence a esta empresa.'], 404);
        }

        $usersCount = $tenant->users()->count();
        if ($usersCount <= 1) {
            return response()->json([
                'message' => 'Não é possível remover o último usuário da empresa. A empresa ficaria sem acesso.',
            ], 422);
        }

        try {
            return DB::transaction(function () use ($tenant, $user) {
                $tenant->users()->detach($user->id);

                if ($user->current_tenant_id === $tenant->id) {
                    $nextTenant = $user->tenants()->first();
                    $user->update([
                        'current_tenant_id' => $nextTenant?->id ?? $user->tenant_id,
                    ]);
                }

                AuditLog::log('deleted', "Usuário {$user->name} removido de {$tenant->name}", $user);
                return response()->json(null, 204);
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao remover usuário.'], 500);
        }
    }

    public function stats(): JsonResponse
    {
        try {
            return response()->json([
                'total' => Tenant::count(),
                'active' => Tenant::where('status', Tenant::STATUS_ACTIVE)->count(),
                'trial' => Tenant::where('status', Tenant::STATUS_TRIAL)->count(),
                'inactive' => Tenant::where('status', Tenant::STATUS_INACTIVE)->count(),
            ]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao carregar estatísticas.'], 500);
        }
    }

    public function availableRoles(Tenant $tenant): JsonResponse
    {
        try {
            $columns = ['id', 'name'];
            if (Schema::hasColumn('roles', 'display_name')) {
                $columns[] = 'display_name';
            }

            $roles = Role::where(function ($q) use ($tenant) {
                $q->where('team_id', $tenant->id)->orWhereNull('team_id');
            })
                ->select($columns)
                ->orderBy('name')
                ->get()
                ->map(fn ($r) => [
                    'name' => $r->name,
                    'display_name' => $r->display_name ?? $r->name,
                ]);

            return response()->json($roles);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao carregar papéis disponíveis.'], 500);
        }
    }
}
