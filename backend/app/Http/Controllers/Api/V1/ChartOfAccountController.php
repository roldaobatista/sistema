<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class ChartOfAccountController extends Controller
{
    use ApiResponseTrait;

    private const TYPES = [
        ChartOfAccount::TYPE_REVENUE,
        ChartOfAccount::TYPE_EXPENSE,
        ChartOfAccount::TYPE_ASSET,
        ChartOfAccount::TYPE_LIABILITY,
    ];

    private function tenantId(Request $request): int
    {
        $user = $request->user();

        return app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $filters = $request->validate([
            'type' => ['nullable', 'string', Rule::in(self::TYPES)],
            'search' => 'nullable|string|max:120',
            'is_active' => 'nullable|boolean',
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists('chart_of_accounts', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenantId)
                ),
            ],
        ]);

        $accounts = ChartOfAccount::query()
            ->where('tenant_id', $tenantId)
            ->with('parent:id,code,name,type')
            ->when(isset($filters['type']), fn ($q) => $q->where('type', $filters['type']))
            ->when(isset($filters['search']), function ($q) use ($filters) {
                $search = trim((string) $filters['search']);

                $q->where(function ($inner) use ($search) {
                    $inner->where('code', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%");
                });
            })
            ->when(array_key_exists('is_active', $filters), fn ($q) => $q->where('is_active', (bool) $filters['is_active']))
            ->when(array_key_exists('parent_id', $filters), fn ($q) => $q->where('parent_id', $filters['parent_id']))
            ->orderBy('code')
            ->get();

        return $this->success($accounts);
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $data = $request->validate([
                'parent_id' => [
                    'nullable',
                    'integer',
                    Rule::exists('chart_of_accounts', 'id')->where(
                        fn ($q) => $q->where('tenant_id', $tenantId)
                    ),
                ],
                'code' => [
                    'required',
                    'string',
                    'max:20',
                    Rule::unique('chart_of_accounts', 'code')->where(
                        fn ($q) => $q->where('tenant_id', $tenantId)
                    ),
                ],
                'name' => 'required|string|max:255',
                'type' => ['required', 'string', Rule::in(self::TYPES)],
                'is_active' => 'sometimes|boolean',
            ]);

            $data['code'] = $this->normalizeCode($data['code']);
            $data['name'] = trim((string) $data['name']);

            $parentError = $this->validateParentConstraints(
                tenantId: $tenantId,
                parentId: $data['parent_id'] ?? null,
                targetType: $data['type']
            );

            if ($parentError !== null) {
                return $parentError;
            }

            $data['tenant_id'] = $tenantId;

            $account = DB::transaction(fn () => ChartOfAccount::create($data));

            return $this->success($account->fresh('parent:id,code,name,type'), 'Conta criada', 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Dados inválidos', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('ChartOfAccount store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar conta'], 500);
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $account = ChartOfAccount::where('tenant_id', $tenantId)
            ->findOrFail($id);

        $data = $request->validate([
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists('chart_of_accounts', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenantId)
                ),
            ],
            'code' => [
                'sometimes',
                'string',
                'max:20',
                Rule::unique('chart_of_accounts', 'code')
                    ->where(fn ($q) => $q->where('tenant_id', $tenantId))
                    ->ignore($account->id),
            ],
            'name' => 'string|max:255',
            'type' => ['string', Rule::in(self::TYPES)],
            'is_active' => 'boolean',
        ]);

        if ($account->is_system) {
            foreach (['parent_id', 'type', 'code'] as $blockedKey) {
                if (array_key_exists($blockedKey, $data)) {
                    return $this->error('Conta do sistema nao permite alteracao estrutural.', 422);
                }
            }
        }

        if (array_key_exists('code', $data)) {
            $data['code'] = $this->normalizeCode($data['code']);
        }

        if (array_key_exists('name', $data)) {
            $data['name'] = trim((string) $data['name']);
        }

        $targetType = $data['type'] ?? $account->type;
        $targetParentId = array_key_exists('parent_id', $data)
            ? ($data['parent_id'] === null ? null : (int) $data['parent_id'])
            : $account->parent_id;

        $parentError = $this->validateParentConstraints(
            tenantId: $tenantId,
            parentId: $targetParentId,
            targetType: $targetType,
            currentAccount: $account
        );

        if ($parentError !== null) {
            return $parentError;
        }

        if (array_key_exists('type', $data)) {
            $hasChildTypeConflict = $account->children()
                ->where('type', '!=', $targetType)
                ->exists();

            if ($hasChildTypeConflict) {
                return $this->error('Nao e possivel trocar tipo com sub-contas de tipo diferente.', 422);
            }
        }

        DB::transaction(fn () => $account->update($data));

        return $this->success($account->fresh('parent:id,code,name,type'), 'Conta atualizada');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $account = ChartOfAccount::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail($id);

        if ($account->is_system) {
            return $this->error('Conta do sistema nao pode ser removida.', 422);
        }

        if ($account->children()->exists()) {
            return $this->error('Nao e possivel excluir conta com sub-contas.', 422);
        }

        $usageCount = $account->receivables()->withTrashed()->count()
            + $account->payables()->withTrashed()->count()
            + $account->expenses()->withTrashed()->count();

        if ($usageCount > 0) {
            return $this->error('Nao e possivel excluir conta ja vinculada a lancamentos financeiros.', 422);
        }

        DB::transaction(fn () => $account->delete());

        return $this->success(null, 'Conta removida');
    }

    private function normalizeCode(string $code): string
    {
        $value = trim($code);
        $value = preg_replace('/\s+/', '', $value);

        return strtoupper((string) $value);
    }

    private function validateParentConstraints(
        int $tenantId,
        ?int $parentId,
        string $targetType,
        ?ChartOfAccount $currentAccount = null
    ): ?JsonResponse {
        if ($parentId === null) {
            return null;
        }

        $parent = ChartOfAccount::query()
            ->where('tenant_id', $tenantId)
            ->find($parentId);

        if ($parent === null) {
            return $this->error('Conta pai informada nao existe neste tenant.', 422);
        }

        if ($currentAccount !== null && $parent->id === $currentAccount->id) {
            return $this->error('Uma conta nao pode ser pai dela mesma.', 422);
        }

        if ($parent->type !== $targetType) {
            return $this->error('Conta pai precisa ter o mesmo tipo da conta filha.', 422);
        }

        if (!$parent->is_active) {
            return $this->error('Nao e possivel vincular a uma conta pai inativa.', 422);
        }

        if ($currentAccount !== null && $this->createsCycle($tenantId, $currentAccount->id, $parent->id)) {
            return $this->error('Operacao invalida: geraria ciclo na hierarquia do plano de contas.', 422);
        }

        return null;
    }

    private function createsCycle(int $tenantId, int $currentAccountId, int $candidateParentId): bool
    {
        $visited = [];
        $walkerId = $candidateParentId;

        while ($walkerId !== null) {
            if ($walkerId === $currentAccountId) {
                return true;
            }

            if (isset($visited[$walkerId])) {
                return true;
            }
            $visited[$walkerId] = true;

            $walker = ChartOfAccount::query()
                ->where('tenant_id', $tenantId)
                ->find($walkerId);

            if ($walker === null || $walker->parent_id === null) {
                return false;
            }

            $walkerId = (int) $walker->parent_id;
        }

        return false;
    }
}
