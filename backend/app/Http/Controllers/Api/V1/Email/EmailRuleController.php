<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\EmailRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EmailRuleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rules = EmailRule::where('tenant_id', $request->user()->current_tenant_id)
            ->orderBy('priority')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $rules]);
    }

    public function show(Request $request, EmailRule $emailRule): JsonResponse
    {
        $this->authorizeTenant($request, $emailRule);

        return response()->json(['data' => $emailRule]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'conditions' => 'required|array|min:1',
            'conditions.*.field' => 'required|string|in:from,to,subject,body,ai_category,ai_priority,ai_sentiment',
            'conditions.*.operator' => 'required|string|in:contains,equals,starts_with,ends_with,regex',
            'conditions.*.value' => 'required|string',
            'actions' => 'required|array|min:1',
            'actions.*.type' => 'required|string|in:create_task,create_chamado,notify,star,archive,mark_read,assign_category',
            'actions.*.params' => 'nullable|array',
            'priority' => 'nullable|integer|min:0|max:999',
            'is_active' => 'boolean',
        ]);

        try {
            DB::beginTransaction();

            $rule = EmailRule::create(array_merge(
                $validated,
                ['tenant_id' => $request->user()->current_tenant_id]
            ));

            DB::commit();

            return response()->json([
                'message' => 'Regra de email criada com sucesso',
                'data' => $rule,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Email rule creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar regra'], 500);
        }
    }

    public function update(Request $request, EmailRule $emailRule): JsonResponse
    {
        $this->authorizeTenant($request, $emailRule);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
            'conditions' => 'sometimes|array|min:1',
            'conditions.*.field' => 'required_with:conditions|string|in:from,to,subject,body,ai_category,ai_priority,ai_sentiment',
            'conditions.*.operator' => 'required_with:conditions|string|in:contains,equals,starts_with,ends_with,regex',
            'conditions.*.value' => 'required_with:conditions|string',
            'actions' => 'sometimes|array|min:1',
            'actions.*.type' => 'required_with:actions|string|in:create_task,create_chamado,notify,star,archive,mark_read,assign_category',
            'actions.*.params' => 'nullable|array',
            'priority' => 'nullable|integer|min:0|max:999',
            'is_active' => 'sometimes|boolean',
        ]);

        try {
            DB::beginTransaction();
            $emailRule->update($validated);
            DB::commit();

            return response()->json([
                'message' => 'Regra atualizada com sucesso',
                'data' => $emailRule->fresh(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Email rule update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar regra'], 500);
        }
    }

    public function destroy(Request $request, EmailRule $emailRule): JsonResponse
    {
        $this->authorizeTenant($request, $emailRule);

        $emailRule->delete();

        return response()->json(['message' => 'Regra removida com sucesso']);
    }

    public function toggleActive(Request $request, EmailRule $emailRule): JsonResponse
    {
        $this->authorizeTenant($request, $emailRule);

        $emailRule->update(['is_active' => !$emailRule->is_active]);

        return response()->json([
            'message' => $emailRule->is_active ? 'Regra ativada' : 'Regra desativada',
            'data' => $emailRule->fresh(),
        ]);
    }

    private function authorizeTenant(Request $request, EmailRule $emailRule): void
    {
        abort_if(
            $emailRule->tenant_id !== $request->user()->current_tenant_id,
            403,
            'Acesso negado'
        );
    }
}
