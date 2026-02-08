<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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
            'document' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => 'sometimes|in:active,inactive,trial',
        ]);

        $tenant = Tenant::create([...$validated, 'status' => $validated['status'] ?? 'active']);

        AuditLog::log('created', "Empresa {$tenant->name} criada", $tenant);

        return response()->json($tenant->loadCount(['users', 'branches']), 201);
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
            'document' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => 'sometimes|in:active,inactive,trial',
        ]);

        $old = $tenant->toArray();
        $tenant->update($validated);

        AuditLog::log('updated', "Empresa {$tenant->name} atualizada", $tenant, $old, $tenant->fresh()->toArray());

        return response()->json($tenant->fresh()->loadCount(['users', 'branches']));
    }

    public function destroy(Tenant $tenant): JsonResponse
    {
        AuditLog::log('deleted', "Empresa {$tenant->name} removida", $tenant);
        $tenant->delete();
        return response()->json(null, 204);
    }

    /**
     * Convidar usuário para um tenant
     */
    public function invite(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'role' => 'sometimes|string|max:50',
        ]);

        // Verificar se usuário já existe
        $user = User::where('email', $validated['email'])->first();

        if ($user) {
            // Associar ao tenant se não estiver
            if (!$tenant->users()->where('user_id', $user->id)->exists()) {
                $tenant->users()->attach($user->id, ['is_default' => false]);
            }
        } else {
            // Criar novo usuário com senha temporária
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make('temp_' . uniqid()),
            ]);
            $tenant->users()->attach($user->id, ['is_default' => true]);
        }

        if (!empty($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        AuditLog::log('created', "Usuário {$user->name} convidado para {$tenant->name}", $user);

        return response()->json(['user' => $user, 'message' => 'Convite realizado'], 201);
    }

    /**
     * Remover usuário de um tenant
     */
    public function removeUser(Tenant $tenant, User $user): JsonResponse
    {
        $tenant->users()->detach($user->id);
        AuditLog::log('deleted', "Usuário {$user->name} removido de {$tenant->name}", $user);
        return response()->json(null, 204);
    }

    /**
     * Estatísticas resumidas
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'total' => Tenant::count(),
            'active' => Tenant::where('status', 'active')->count(),
            'trial' => Tenant::where('status', 'trial')->count(),
            'inactive' => Tenant::where('status', 'inactive')->count(),
        ]);
    }
}
