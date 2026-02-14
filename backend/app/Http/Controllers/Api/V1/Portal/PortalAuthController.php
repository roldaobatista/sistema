<?php

namespace App\Http\Controllers\Api\V1\Portal;

use App\Http\Controllers\Controller;
use App\Models\ClientPortalUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class PortalAuthController extends Controller
{
    public function login(Request $request)
    {
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
                'email' => ['As credenciais fornecidas estao incorretas.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Sua conta esta inativa.'],
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
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->noContent();
    }
}