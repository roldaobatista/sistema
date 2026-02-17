<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BranchController extends Controller
{
    /**
     * Lista filiais do tenant atual com busca opcional.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Branch::orderBy('name');

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('code', 'like', $term)
                  ->orWhere('address_city', 'like', $term);
            });
        }

        $branches = $query->get();
        return response()->json($branches);
    }

    public function store(Request $request): JsonResponse
    {
        if (!app()->bound('current_tenant_id')) {
            return response()->json(['message' => 'Nenhuma empresa selecionada.'], 403);
        }

        $tenantId = app('current_tenant_id');

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => [
                'nullable', 'string', 'max:20',
                Rule::unique('branches', 'code')->where('tenant_id', $tenantId),
            ],
            'address_street' => 'nullable|string|max:255',
            'address_number' => 'nullable|string|max:20',
            'address_complement' => 'nullable|string|max:100',
            'address_neighborhood' => 'nullable|string|max:100',
            'address_city' => 'nullable|string|max:100',
            'address_state' => 'nullable|string|max:2',
            'address_zip' => 'nullable|string|max:10',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
        ]);

        try {
            return DB::transaction(function () use ($validated, $tenantId) {
                $validated['tenant_id'] = $tenantId;
                $branch = Branch::create($validated);

                AuditLog::log('created', "Filial {$branch->name} criada", $branch);

                return response()->json($branch, 201);
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao criar filial.'], 500);
        }
    }

    public function show(Branch $branch): JsonResponse
    {
        return response()->json($branch);
    }

    public function update(Request $request, Branch $branch): JsonResponse
    {
        if (!app()->bound('current_tenant_id')) {
            return response()->json(['message' => 'Nenhuma empresa selecionada.'], 403);
        }

        $tenantId = app('current_tenant_id');

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => [
                'nullable', 'string', 'max:20',
                Rule::unique('branches', 'code')
                    ->where('tenant_id', $tenantId)
                    ->ignore($branch->id),
            ],
            'address_street' => 'nullable|string|max:255',
            'address_number' => 'nullable|string|max:20',
            'address_complement' => 'nullable|string|max:100',
            'address_neighborhood' => 'nullable|string|max:100',
            'address_city' => 'nullable|string|max:100',
            'address_state' => 'nullable|string|max:2',
            'address_zip' => 'nullable|string|max:10',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
        ]);

        try {
            return DB::transaction(function () use ($validated, $branch) {
                $old = $branch->toArray();
                $branch->update($validated);

                $freshBranch = $branch->fresh();
                AuditLog::log('updated', "Filial {$freshBranch->name} atualizada", $freshBranch, $old, $freshBranch->toArray());

                return response()->json($freshBranch);
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao atualizar filial.'], 500);
        }
    }

    public function destroy(Branch $branch): JsonResponse
    {
        $sequencesCount = \App\Models\NumberingSequence::withoutGlobalScope('tenant')
            ->where('branch_id', $branch->id)
            ->count();

        $workOrdersCount = \App\Models\WorkOrder::withoutGlobalScope('tenant')
            ->where('branch_id', $branch->id)
            ->count();

        $usersCount = \App\Models\User::where('branch_id', $branch->id)->count();

        if ($sequencesCount > 0 || $workOrdersCount > 0 || $usersCount > 0) {
            $dependencies = [];
            if ($sequencesCount > 0) $dependencies['numbering_sequences'] = $sequencesCount;
            if ($workOrdersCount > 0) $dependencies['work_orders'] = $workOrdersCount;
            if ($usersCount > 0) $dependencies['users'] = $usersCount;

            $msg = "Esta filial possui registros vinculados: ";
            $parts = [];
            if ($sequencesCount > 0) $parts[] = "$sequencesCount sequência(s)";
            if ($workOrdersCount > 0) $parts[] = "$workOrdersCount ordem(ns) de serviço";
            if ($usersCount > 0) $parts[] = "$usersCount usuário(s)";
            $msg .= implode(', ', $parts) . ".";

            return response()->json([
                'message' => $msg,
                'dependencies' => $dependencies,
                'confirm_required' => true,
            ], 409);
        }

        try {
            return DB::transaction(function () use ($branch) {
                AuditLog::log('deleted', "Filial {$branch->name} removida", $branch);
                $branch->delete();

                return response()->json(null, 204);
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'Erro ao excluir filial.'], 500);
        }
    }
}
