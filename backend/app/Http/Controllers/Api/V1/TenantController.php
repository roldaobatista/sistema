<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use App\Services\TenantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Auth;

class TenantController extends Controller
{
    protected TenantService $service;

    public function __construct(TenantService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $tenants = $this->service->list($request->only(['search', 'status']), $request->get('per_page', 50));
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
            $tenant = $this->service->create($validated);
            return response()->json($tenant->loadCount(['users', 'branches']), 201);
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
            $freshTenant = $this->service->update($tenant, $validated);
            return response()->json($freshTenant->loadCount(['users', 'branches']));
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao atualizar empresa.'], 500);
        }
    }

    public function destroy(Tenant $tenant): JsonResponse
    {
        try {
            $result = $this->service->delete($tenant);

            if (is_array($result)) {
                return response()->json([
                    'message' => 'Não é possível excluir empresa com dados vinculados.',
                    'dependencies' => $result,
                ], 409);
            }

            return response()->json(null, 204);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao excluir empresa.'], 500);
        }
    }

    /**
     * Convidar usuário para um tenant.
     */
    public function invite(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'role' => 'nullable|string|max:50',
        ]);

        try {
            $result = $this->service->inviteUser($tenant, $validated);

            return response()->json([
                'user' => $result['user'],
                'message' => $result['is_new']
                    ? 'Usuário criado e notificação de definição de senha enviada.'
                    : 'Usuário existente vinculado à empresa.',
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->getCode() === 422 ? ['role' => [$e->getMessage()]] : null
            ], $e->getCode() ?: 500);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao convidar usuário.'], 500);
        }
    }

    /**
     * Remover usuário de um tenant.
     */
    public function removeUser(Tenant $tenant, User $user): JsonResponse
    {
        try {
            $this->service->removeUser($tenant, $user, Auth::user());
            return response()->json(null, 204);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 500);
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
