<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\PermissionRegistrar;

class AuthController extends Controller
{
    /**
     * Login — gera token Sanctum.
     */
    public function login(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required|string',
            ]);

            // Brute force protection: 5 attempts per 15 minutes per IP+email
            $throttleKey = 'login_attempts:' . $request->ip() . ':' . strtolower($request->email);
            $attempts = (int) Cache::get($throttleKey, 0);

            if ($attempts >= 5) {
                $ttl = Cache::get($throttleKey . ':ttl', 0);
                $remainingMinutes = ($ttl > 0 && $ttl > now()->timestamp)
                    ? (int) ceil(($ttl - now()->timestamp) / 60)
                    : 15;
                $remainingMinutes = max(1, $remainingMinutes); // Nunca mostrar 0 minutos
                return response()->json([
                    'message' => "Muitas tentativas de login. Tente novamente em {$remainingMinutes} minutos.",
                ], 429);
            }

            $user = User::where('email', $request->email)->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                // Increment failed attempts
                Cache::put($throttleKey, $attempts + 1, now()->addMinutes(15));
                Cache::put($throttleKey . ':ttl', now()->addMinutes(15)->timestamp, now()->addMinutes(15));

                throw ValidationException::withMessages([
                    'email' => ['Credenciais inválidas.'],
                ]);
            }

            if (!$user->is_active) {
                return response()->json(['message' => 'Conta desativada.'], 403);
            }

            // Clear failed attempts on successful login
            Cache::forget($throttleKey);
            Cache::forget($throttleKey . ':ttl');

            // Atualiza último login
            $user->update(['last_login_at' => now()]);

            // Revogar tokens API anteriores para evitar acúmulo ilimitado
            $user->tokens()->where('name', 'api')->delete();

            // Gera token
            $token = $user->createToken('api')->plainTextToken;

            // Carrega tenant padrão
            $defaultTenant = $user->tenants()->wherePivot('is_default', true)->first();
            if ($defaultTenant && !$user->current_tenant_id) {
                $user->update(['current_tenant_id' => $defaultTenant->id]);
                $user->refresh();
            }

            return response()->json([
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'tenant_id' => $user->current_tenant_id,
                    'tenant' => $defaultTenant,
                    'permissions' => $user->getAllPermissions()->pluck('name'),
                    'roles' => $user->getRoleNames(),
                ],
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('Login Error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => 'Erro interno ao realizar login.',
            ], 500);
        }
    }

    /**
     * Dados do usuário autenticado.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('currentTenant');

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'tenant' => $user->currentTenant,
                'permissions' => $user->getAllPermissions()->pluck('name'),
                'roles' => $user->getRoleNames(),
                'last_login_at' => $user->last_login_at,
            ],
        ]);
    }

    /**
     * Logout — revoga token atual.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logout realizado.']);
    }

    /** Lista tenants disponíveis para o usuário */
    public function myTenants(Request $request): JsonResponse
    {
        $tenants = $request->user()->tenants()->get(['tenants.id', 'tenants.name', 'tenants.document']);
        return response()->json($tenants);
    }

    /** Troca o tenant ativo */
    public function switchTenant(Request $request): JsonResponse
    {
        $validated = $request->validate(['tenant_id' => 'required|integer']);
        $user = $request->user();

        // Verifica se o user pertence a este tenant
        if (!$user->tenants()->where('tenants.id', $validated['tenant_id'])->exists()) {
            return response()->json(['message' => 'Acesso negado a esta empresa.'], 403);
        }

        $user->update(['current_tenant_id' => $validated['tenant_id']]);

        // Invalidate Spatie permission cache to load new tenant permissions
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['message' => 'Empresa alterada.', 'tenant_id' => $validated['tenant_id']]);
    }
}
