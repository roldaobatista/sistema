<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\EmailSignature;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EmailSignatureController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $signatures = EmailSignature::where('user_id', auth()->id())
                ->with('account')
                ->get();

            return response()->json($signatures);
        } catch (\Exception $e) {
            Log::error('EmailSignature index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar assinaturas'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'email_account_id' => 'nullable|exists:email_accounts,id',
                'name' => 'required|string|max:255',
                'html_content' => 'required|string',
                'is_default' => 'boolean',
            ]);

            $signature = new EmailSignature($validated);
            $signature->user_id = auth()->id();
            $signature->save();

            if ($signature->is_default) {
                EmailSignature::where('user_id', auth()->id())
                    ->where('id', '!=', $signature->id)
                    ->where('email_account_id', $signature->email_account_id)
                    ->update(['is_default' => false]);
            }

            DB::commit();
            return response()->json($signature, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmailSignature store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar assinatura'], 500);
        }
    }

    public function update(Request $request, EmailSignature $emailSignature): JsonResponse
    {
        try {
            DB::beginTransaction();

            if ($emailSignature->user_id !== auth()->id()) {
                abort(403);
            }

            $validated = $request->validate([
                'email_account_id' => 'nullable|exists:email_accounts,id',
                'name' => 'sometimes|string|max:255',
                'html_content' => 'sometimes|string',
                'is_default' => 'boolean',
            ]);

            $emailSignature->update($validated);

            if ($emailSignature->is_default) {
                EmailSignature::where('user_id', auth()->id())
                    ->where('id', '!=', $emailSignature->id)
                    ->where('email_account_id', $emailSignature->email_account_id)
                    ->update(['is_default' => false]);
            }

            DB::commit();
            return response()->json($emailSignature);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmailSignature update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar assinatura'], 500);
        }
    }

    public function destroy(EmailSignature $emailSignature): JsonResponse
    {
        try {
            if ($emailSignature->user_id !== auth()->id()) {
                abort(403);
            }
            $emailSignature->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('EmailSignature destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir assinatura'], 500);
        }
    }
}
