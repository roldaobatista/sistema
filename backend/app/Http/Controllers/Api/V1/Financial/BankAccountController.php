<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class BankAccountController extends Controller
{
    use ResolvesCurrentTenant;

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $query = BankAccount::where('tenant_id', $tenantId)
            ->with('creator:id,name')
            ->orderBy('name');

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('bank_name', 'like', "%{$search}%")
                  ->orWhere('account_number', 'like', "%{$search}%");
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'bank_name' => ['required', 'string', 'max:255'],
            'agency' => ['nullable', 'string', 'max:20'],
            'account_number' => ['nullable', 'string', 'max:30'],
            'account_type' => ['required', Rule::in(array_keys(BankAccount::ACCOUNT_TYPES))],
            'pix_key' => ['nullable', 'string', 'max:255'],
            'balance' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        try {
            DB::beginTransaction();

            $account = BankAccount::create([
                ...$validated,
                'tenant_id' => $tenantId,
                'balance' => $validated['balance'] ?? 0,
                'is_active' => $validated['is_active'] ?? true,
                'created_by' => $request->user()->id,
            ]);

            DB::commit();

            return response()->json(
                $account->load('creator:id,name'),
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('BankAccount create failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao criar conta bancária'], 500);
        }
    }

    public function show(Request $request, BankAccount $bankAccount): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        if ((int) $bankAccount->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Conta não encontrada'], 404);
        }

        return response()->json(
            $bankAccount->load('creator:id,name')
        );
    }

    public function update(Request $request, BankAccount $bankAccount): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        if ((int) $bankAccount->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Conta não encontrada'], 404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'bank_name' => ['sometimes', 'string', 'max:255'],
            'agency' => ['nullable', 'string', 'max:20'],
            'account_number' => ['nullable', 'string', 'max:30'],
            'account_type' => ['sometimes', Rule::in(array_keys(BankAccount::ACCOUNT_TYPES))],
            'pix_key' => ['nullable', 'string', 'max:255'],
            'balance' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        try {
            DB::beginTransaction();
            $bankAccount->update($validated);
            DB::commit();

            return response()->json(
                $bankAccount->fresh()->load('creator:id,name')
            );
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('BankAccount update failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao atualizar conta bancária'], 500);
        }
    }

    public function destroy(Request $request, BankAccount $bankAccount): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        if ((int) $bankAccount->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Conta não encontrada'], 404);
        }

        $activeTransfers = $bankAccount->fundTransfers()
            ->where('status', 'completed')
            ->exists();

        if ($activeTransfers) {
            return response()->json([
                'message' => 'Esta conta possui transferências ativas. Cancele-as antes de excluir.',
            ], 422);
        }

        try {
            DB::beginTransaction();
            $bankAccount->delete();
            DB::commit();

            return response()->json(['message' => 'Conta bancária excluída com sucesso']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('BankAccount delete failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao excluir conta bancária'], 500);
        }
    }
}
