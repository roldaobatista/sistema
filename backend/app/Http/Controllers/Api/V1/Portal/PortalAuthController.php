<?php

namespace App\Http\Controllers\Api\V1\Portal;

use App\Http\Controllers\Controller;
use App\Models\ClientPortalUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class PortalAuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
            'tenant_id' => 'required|exists:tenants,id', // Multi-tenant context
        ]);

        $user = ClientPortalUser::where('tenant_id', $request->tenant_id)
            ->where('email', $request->email)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['As credenciais fornecidas estão incorretas.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Sua conta está inativa.'],
            ]);
        }

        $user->update(['last_login_at' => now()]);

        // Create token explicitly for 'portal' ability if needed, or general access
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
        $request->user()->currentAccessToken()->delete();
        return response()->noContent();
    }
}
