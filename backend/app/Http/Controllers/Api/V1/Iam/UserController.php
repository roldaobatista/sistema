<?php

namespace App\Http\Controllers\Api\V1\Iam;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $query = User::whereHas('tenants', fn($q) => $q->where('tenants.id', $tenantId))
            ->with('roles:id,name');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($roleFilter = $request->get('role')) {
            $query->whereHas('roles', fn($q) => $q->where('name', $roleFilter));
        }

        $users = $query->orderBy('name')
            ->paginate($request->get('per_page', 15));

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:20',
            'password' => 'required|string|min:8',
            'roles' => 'array',
            'roles.*' => 'exists:roles,id',
            'is_active' => 'boolean',
        ]);

        $tenantId = app('current_tenant_id');

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => $validated['password'],
            'is_active' => $validated['is_active'] ?? true,
            'tenant_id' => $tenantId,
            'current_tenant_id' => $tenantId,
        ]);

        $user->tenants()->attach($tenantId, ['is_default' => true]);

        if (!empty($validated['roles'])) {
            $user->syncRoles($validated['roles']);
        }

        $user->load('roles:id,name');

        return response()->json($user, 201);
    }

    public function show(User $user): JsonResponse
    {
        $user->load(['roles:id,name', 'roles.permissions:id,name']);
        return response()->json($user);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'phone' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:8',
            'roles' => 'array',
            'roles.*' => 'exists:roles,id',
            'is_active' => 'boolean',
        ]);

        $data = collect($validated)->except(['roles', 'password'])->toArray();

        if (!empty($validated['password'])) {
            $data['password'] = $validated['password'];
        }

        $user->update($data);

        if (isset($validated['roles'])) {
            $user->syncRoles($validated['roles']);
        }

        $user->load('roles:id,name');

        return response()->json($user);
    }

    public function destroy(User $user): JsonResponse
    {
        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'Você não pode excluir sua própria conta.'], 422);
        }

        $user->delete();
        return response()->json(null, 204);
    }

    public function toggleActive(User $user): JsonResponse
    {
        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'Você não pode desativar sua própria conta.'], 422);
        }

        $user->update(['is_active' => !$user->is_active]);
        return response()->json(['is_active' => $user->is_active]);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $user->update(['password' => $validated['password']]);
        return response()->json(['message' => 'Senha atualizada.']);
    }

    /**
     * Dropdown: lista users ativos por role(s).
     * GET /users/by-role/tecnico ou /users/by-role/tecnico,vendedor
     */
    public function byRole(string $role): JsonResponse
    {
        $roles = explode(',', $role);
        $tenantId = app('current_tenant_id');

        $users = User::whereHas('tenants', fn($q) => $q->where('tenants.id', $tenantId))
            ->where('is_active', true)
            ->whereHas('roles', fn($q) => $q->whereIn('name', $roles))
            ->with('roles:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return response()->json($users);
    }
}
