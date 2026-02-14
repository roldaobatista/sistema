<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ReconciliationRule;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReconciliationRuleController extends Controller
{
    use ApiResponseTrait;

    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);

            $query = ReconciliationRule::where('tenant_id', $tenantId)
                ->with(['customer:id,name', 'supplier:id,name']);

            if ($request->filled('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            if ($request->filled('action')) {
                $query->where('action', $request->input('action'));
            }

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                      ->orWhere('match_value', 'LIKE', "%{$search}%");
                });
            }

            $rules = $query->orderBy('priority')->orderBy('name')->paginate(25);

            return $this->success($rules);
        } catch (\Throwable $e) {
            Log::error('ReconciliationRule index failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao listar regras.', 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'match_field' => 'required|in:description,amount,cnpj,combined',
            'match_operator' => 'required|in:contains,equals,regex,between',
            'match_value' => 'nullable|string|max:500',
            'match_amount_min' => 'nullable|numeric|min:0',
            'match_amount_max' => 'nullable|numeric|min:0',
            'action' => 'required|in:match_receivable,match_payable,ignore,categorize',
            'target_type' => 'nullable|string',
            'target_id' => 'nullable|integer',
            'category' => 'nullable|string|max:100',
            'customer_id' => 'nullable|exists:customers,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'priority' => 'integer|min:1|max:100',
            'is_active' => 'boolean',
        ]);

        try {
            $tenantId = $this->tenantId($request);
            $validated['tenant_id'] = $tenantId;
            $validated['priority'] = $validated['priority'] ?? 50;
            $validated['is_active'] = $validated['is_active'] ?? true;

            $rule = ReconciliationRule::create($validated);

            return $this->success($rule->load(['customer:id,name', 'supplier:id,name']), 'Regra criada com sucesso', 201);
        } catch (\Throwable $e) {
            Log::error('ReconciliationRule store failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao criar regra.', 500);
        }
    }

    public function show(Request $request, int $id): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);
            $rule = ReconciliationRule::where('tenant_id', $tenantId)
                ->with(['customer:id,name', 'supplier:id,name'])
                ->findOrFail($id);

            return $this->success($rule);
        } catch (\Throwable $e) {
            Log::error('ReconciliationRule show failed', ['error' => $e->getMessage()]);
            return $this->error('Regra não encontrada.', 404);
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'match_field' => 'sometimes|in:description,amount,cnpj,combined',
            'match_operator' => 'sometimes|in:contains,equals,regex,between',
            'match_value' => 'nullable|string|max:500',
            'match_amount_min' => 'nullable|numeric|min:0',
            'match_amount_max' => 'nullable|numeric|min:0',
            'action' => 'sometimes|in:match_receivable,match_payable,ignore,categorize',
            'target_type' => 'nullable|string',
            'target_id' => 'nullable|integer',
            'category' => 'nullable|string|max:100',
            'customer_id' => 'nullable|exists:customers,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'priority' => 'integer|min:1|max:100',
            'is_active' => 'boolean',
        ]);

        try {
            $tenantId = $this->tenantId($request);
            $rule = ReconciliationRule::where('tenant_id', $tenantId)->findOrFail($id);
            $rule->update($validated);

            return $this->success($rule->load(['customer:id,name', 'supplier:id,name']), 'Regra atualizada');
        } catch (\Throwable $e) {
            Log::error('ReconciliationRule update failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao atualizar regra.', 500);
        }
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);
            $rule = ReconciliationRule::where('tenant_id', $tenantId)->findOrFail($id);
            $rule->delete();

            return $this->success(null, 'Regra excluída');
        } catch (\Throwable $e) {
            Log::error('ReconciliationRule destroy failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao excluir regra.', 500);
        }
    }

    public function toggleActive(Request $request, int $id): JsonResponse
    {
        try {
            $tenantId = $this->tenantId($request);
            $rule = ReconciliationRule::where('tenant_id', $tenantId)->findOrFail($id);
            $rule->update(['is_active' => !$rule->is_active]);

            $label = $rule->is_active ? 'ativada' : 'desativada';
            return $this->success($rule, "Regra {$label}");
        } catch (\Throwable $e) {
            Log::error('ReconciliationRule toggle failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao alternar regra.', 500);
        }
    }

    /**
     * Test a rule against existing pending entries without applying.
     */
    public function testRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'match_field' => 'required|in:description,amount,cnpj,combined',
            'match_operator' => 'required|in:contains,equals,regex,between',
            'match_value' => 'nullable|string|max:500',
            'match_amount_min' => 'nullable|numeric|min:0',
            'match_amount_max' => 'nullable|numeric|min:0',
        ]);

        try {
            $tenantId = $this->tenantId($request);

            // Create temporary rule instance (not persisted)
            $tempRule = new ReconciliationRule($validated);

            $pending = \App\Models\BankStatementEntry::where('tenant_id', $tenantId)
                ->where('status', \App\Models\BankStatementEntry::STATUS_PENDING)
                ->limit(200)
                ->get();

            $matches = $pending->filter(fn($entry) => $tempRule->matches($entry));

            return $this->success([
                'total_tested' => $pending->count(),
                'total_matched' => $matches->count(),
                'sample' => $matches->take(10)->map(fn($e) => [
                    'id' => $e->id,
                    'date' => $e->date?->toDateString(),
                    'description' => $e->description,
                    'amount' => (float) $e->amount,
                    'type' => $e->type,
                ])->values(),
            ]);
        } catch (\Throwable $e) {
            Log::error('ReconciliationRule test failed', ['error' => $e->getMessage()]);
            return $this->error('Erro ao testar regra.', 500);
        }
    }
}
