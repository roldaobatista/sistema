<?php

namespace App\Http\Controllers\Api\V1\Portal;

use App\Http\Controllers\Controller;
use App\Models\ClientPortalUser;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class PortalAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required',
                'tenant_id' => 'required|exists:tenants,id',
            ]);

            $throttleKey = sprintf(
                'portal_login_attempts:%s:%s:%s',
                $request->ip(),
                (string) $request->input('tenant_id'),
                strtolower((string) $request->input('email'))
            );

            $attempts = (int) Cache::get($throttleKey, 0);
            if ($attempts >= 5) {
                $ttl = Cache::get($throttleKey . ':ttl', 0);
                $remainingMinutes = ($ttl > 0 && $ttl > now()->timestamp)
                    ? (int) ceil(($ttl - now()->timestamp) / 60)
                    : 15;

                return response()->json([
                    'message' => "Muitas tentativas de login. Tente novamente em {$remainingMinutes} minutos.",
                ], 429);
            }

            $user = ClientPortalUser::where('tenant_id', $request->tenant_id)
                ->where('email', $request->email)
                ->first();

            if (! $user || ! Hash::check($request->password, $user->password)) {
                Cache::put($throttleKey, $attempts + 1, now()->addMinutes(15));
                Cache::put($throttleKey . ':ttl', now()->addMinutes(15)->timestamp, now()->addMinutes(15));

                throw ValidationException::withMessages([
                    'email' => ['As credenciais fornecidas estão incorretas.'],
                ]);
            }

            if (! $user->is_active) {
                throw ValidationException::withMessages([
                    'email' => ['Sua conta está inativa.'],
                ]);
            }

            Cache::forget($throttleKey);
            Cache::forget($throttleKey . ':ttl');

            $user->update(['last_login_at' => now()]);

            $token = $user->createToken('portal-token', ['portal:access'])->plainTextToken;

            return response()->json([
                'token' => $token,
                'user' => $user->load('customer'),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('PortalAuth login failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao realizar login'], 500);
        }
    }

    public function me(Request $request): JsonResponse
    {
        try {
            return response()->json($request->user());
        } catch (\Exception $e) {
            Log::error('PortalAuth me failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar usuário'], 500);
        }
    }

    public function logout(Request $request): JsonResponse
    {
        try {
            $request->user()->currentAccessToken()?->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('PortalAuth logout failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao realizar logout'], 500);
        }
    }
}