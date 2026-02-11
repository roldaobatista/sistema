<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChartOfAccountController extends Controller
{
    use ApiResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $accounts = ChartOfAccount::where('tenant_id', $request->user()->tenant_id)
            ->with(['parent', 'children'])
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->orderBy('code')
            ->get();

        return $this->success($accounts);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'parent_id' => 'nullable|integer|exists:chart_of_accounts,id',
            'code' => 'required|string|max:20',
            'name' => 'required|string|max:255',
            'type' => 'required|string|in:revenue,expense,asset,liability',
        ]);

        $data['tenant_id'] = $request->user()->tenant_id;

        $account = ChartOfAccount::create($data);

        return $this->success($account, 'Conta criada', 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $account = ChartOfAccount::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $data = $request->validate([
            'parent_id' => 'nullable|integer|exists:chart_of_accounts,id',
            'code' => 'string|max:20',
            'name' => 'string|max:255',
            'type' => 'string|in:revenue,expense,asset,liability',
            'is_active' => 'boolean',
        ]);

        $account->update($data);

        return $this->success($account, 'Conta atualizada');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $account = ChartOfAccount::where('tenant_id', $request->user()->tenant_id)
            ->where('is_system', false)
            ->findOrFail($id);

        if ($account->children()->exists()) {
            return $this->error('Não é possível excluir conta com sub-contas.', 422);
        }

        $account->delete();

        return $this->success(null, 'Conta removida');
    }
}
