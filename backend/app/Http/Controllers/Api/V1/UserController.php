<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password as PasswordRule;

class UserController extends Controller
{
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('currentTenant');

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'tenant' => $user->currentTenant,
            'permissions' => $user->getEffectivePermissions()->pluck('name'),
            'roles' => $user->getRoleNames(),
            'last_login_at' => $user->last_login_at,
            'created_at' => $user->created_at,
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => "sometimes|email|unique:users,email,{$user->id}",
            'phone' => 'nullable|string|max:20',
            'current_password' => 'required_with:password|string',
            'password' => 'sometimes|string|min:8|confirmed',
        ]);

        if (isset($validated['password'])) {
            if (!Hash::check($validated['current_password'], $user->password)) {
                return response()->json(['message' => 'Senha atual incorreta.'], 422);
            }
        }

        try {
            unset($validated['current_password']);

            DB::transaction(function () use ($user, $validated) {
                $user->update($validated);
            });

            AuditLog::log('updated', "Perfil do usuário {$user->name} atualizado", $user);

            return response()->json([
                'message' => 'Perfil atualizado.',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Profile update failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar perfil.'], 500);
        }
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['message' => 'Senha atual incorreta.'], 422);
        }

        try {
            DB::transaction(function () use ($user, $validated) {
                $user->update(['password' => $validated['new_password']]);

                // Revogar todos os tokens exceto o atual por segurança
                $currentTokenId = $user->currentAccessToken()?->id;
                $user->tokens()->where('id', '!=', $currentTokenId)->delete();
            });

            return response()->json(['message' => 'Senha alterada com sucesso.']);
        } catch (\Exception $e) {
            Log::error('Password change failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao alterar senha.'], 500);
        }
    }
}
