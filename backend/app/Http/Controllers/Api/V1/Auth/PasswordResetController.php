<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;

class PasswordResetController extends Controller
{
    /**
     * Envia link de redefinição de senha por email.
     */
    public function sendResetLink(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json([
                'message' => 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.',
            ]);
        }

        // Retorna mensagem genérica para não revelar se o email existe
        return response()->json([
            'message' => 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.',
        ]);
    }

    /**
     * Redefine a senha usando o token.
     */
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->save();

                // Revoga todos os tokens existentes por segurança
                $user->tokens()->delete();

                // Registra no audit log
                $tenantId = $user->current_tenant_id ?? $user->tenant_id;
                if ($tenantId) {
                    app()->instance('current_tenant_id', $tenantId);
                }
                \App\Models\AuditLog::log('password_reset', "Senha redefinida via 'Esqueci minha senha' para {$user->email}", $user);
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Senha redefinida com sucesso. Faça login com a nova senha.']);
        }

        $messages = [
            Password::INVALID_TOKEN => 'Token de redefinição inválido ou expirado.',
            Password::INVALID_USER => 'Usuário não encontrado.',
            Password::RESET_THROTTLED => 'Aguarde antes de solicitar outra redefinição.',
        ];

        return response()->json([
            'message' => $messages[$status] ?? 'Erro ao redefinir senha.',
        ], 422);
    }
}
