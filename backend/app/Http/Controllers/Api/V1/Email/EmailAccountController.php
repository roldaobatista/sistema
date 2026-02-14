<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\EmailAccount;
use App\Jobs\SyncEmailAccountJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EmailAccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $accounts = EmailAccount::where('tenant_id', $request->user()->current_tenant_id)
            ->orderBy('name')
            ->get()
            ->map(fn ($a) => $a->makeHidden('imap_password'));

        return response()->json(['data' => $accounts]);
    }

    public function show(Request $request, EmailAccount $emailAccount): JsonResponse
    {
        $this->authorizeTenant($request, $emailAccount);

        return response()->json([
            'data' => $emailAccount->makeHidden('imap_password'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:255',
            'imap_host' => 'required|string|max:255',
            'imap_port' => 'required|integer|min:1|max:65535',
            'imap_encryption' => 'required|in:ssl,tls,none',
            'imap_username' => 'required|string|max:255',
            'imap_password' => 'required|string|max:500',
            'smtp_host' => 'nullable|string|max:255',
            'smtp_port' => 'nullable|integer|min:1|max:65535',
            'smtp_encryption' => 'nullable|in:ssl,tls,none',
            'is_active' => 'boolean',
        ]);

        try {
            DB::beginTransaction();

            $account = EmailAccount::create(array_merge(
                $validated,
                ['tenant_id' => $request->user()->current_tenant_id]
            ));

            DB::commit();

            return response()->json([
                'message' => 'Conta de email criada com sucesso',
                'data' => $account->makeHidden('imap_password'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Email account creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar conta de email'], 500);
        }
    }

    public function update(Request $request, EmailAccount $emailAccount): JsonResponse
    {
        $this->authorizeTenant($request, $emailAccount);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'email' => 'sometimes|email|max:255',
            'imap_host' => 'sometimes|string|max:255',
            'imap_port' => 'sometimes|integer|min:1|max:65535',
            'imap_encryption' => 'sometimes|in:ssl,tls,none',
            'imap_username' => 'sometimes|string|max:255',
            'imap_password' => 'sometimes|string|max:500',
            'smtp_host' => 'nullable|string|max:255',
            'smtp_port' => 'nullable|integer|min:1|max:65535',
            'smtp_encryption' => 'nullable|in:ssl,tls,none',
            'is_active' => 'sometimes|boolean',
        ]);

        try {
            DB::beginTransaction();
            $emailAccount->update($validated);
            DB::commit();

            return response()->json([
                'message' => 'Conta de email atualizada',
                'data' => $emailAccount->fresh()->makeHidden('imap_password'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Email account update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar conta'], 500);
        }
    }

    public function destroy(Request $request, EmailAccount $emailAccount): JsonResponse
    {
        $this->authorizeTenant($request, $emailAccount);

        $emailCount = $emailAccount->emails()->count();
        if ($emailCount > 0) {
            return response()->json([
                'message' => "Esta conta possui {$emailCount} emails sincronizados. Desative em vez de excluir.",
            ], 409);
        }

        $emailAccount->delete();

        return response()->json(['message' => 'Conta de email removida']);
    }

    public function syncNow(Request $request, EmailAccount $emailAccount): JsonResponse
    {
        $this->authorizeTenant($request, $emailAccount);

        if (!$emailAccount->is_active) {
            return response()->json(['message' => 'Conta inativa'], 422);
        }

        if ($emailAccount->sync_status === 'syncing') {
            return response()->json(['message' => 'Sincronização já em andamento'], 422);
        }

        SyncEmailAccountJob::dispatch($emailAccount);

        return response()->json(['message' => 'Sincronização iniciada']);
    }

    public function testConnection(Request $request, EmailAccount $emailAccount): JsonResponse
    {
        $this->authorizeTenant($request, $emailAccount);

        try {
            $client = new \Webklex\IMAP\Client([
                'host' => $emailAccount->imap_host,
                'port' => $emailAccount->imap_port,
                'encryption' => $emailAccount->imap_encryption,
                'username' => $emailAccount->imap_username,
                'password' => $emailAccount->imap_password,
                'protocol' => 'imap',
                'validate_cert' => false,
            ]);
            $client->connect();
            $folders = $client->getFolders();
            $client->disconnect();

            return response()->json([
                'message' => 'Conexão bem-sucedida',
                'folders' => collect($folders)->pluck('name'),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Falha na conexão',
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    private function authorizeTenant(Request $request, EmailAccount $emailAccount): void
    {
        abort_if(
            $emailAccount->tenant_id !== $request->user()->current_tenant_id,
            403,
            'Acesso negado'
        );
    }
}
