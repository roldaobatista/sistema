<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BatchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $query = Batch::where('tenant_id', $tenantId)
            ->with('product');

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->filled('search')) {
            $query->where('batch_number', 'like', "%{$request->search}%");
        }

        if ($request->boolean('active_only', true)) {
            $query->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>=', now());
            });
        }

        $batches = $query->latest()->paginate($request->integer('per_page', 50));

        return response()->json($batches);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $validated = $request->validate([
            'product_id' => "required|exists:products,id,tenant_id,{$tenantId}",
            'batch_number' => "required|string|max:50|unique:batches,batch_number,NULL,id,tenant_id,{$tenantId}",
            'manufacturing_date' => 'nullable|date',
            'expires_at' => 'nullable|date|after_or_equal:manufacturing_date',
            'supplier_id' => "nullable|exists:suppliers,id,tenant_id,{$tenantId}",
            'initial_quantity' => 'nullable|numeric|min:0',
        ]);

        try {
            DB::beginTransaction();
            $batch = Batch::create(array_merge($validated, ['tenant_id' => $tenantId]));
            DB::commit();

            return response()->json([
                'message' => 'Lote criado com sucesso',
                'data' => $batch->load('product'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Batch creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar lote'], 500);
        }
    }

    public function show(Batch $batch): JsonResponse
    {
        $this->authorizeTenant($batch);
        return response()->json($batch->load(['product', 'stocks.warehouse']));
    }

    public function update(Request $request, Batch $batch): JsonResponse
    {
        $this->authorizeTenant($batch);
        $tenantId = app('current_tenant_id');

        $validated = $request->validate([
            'batch_number' => "required|string|max:50|unique:batches,batch_number,{$batch->id},id,tenant_id,{$tenantId}",
            'manufacturing_date' => 'nullable|date',
            'expires_at' => 'nullable|date|after_or_equal:manufacturing_date',
            'supplier_id' => "nullable|exists:suppliers,id,tenant_id,{$tenantId}",
        ]);

        try {
            $batch->update($validated);

            return response()->json([
                'message' => 'Lote atualizado com sucesso',
                'data' => $batch->load('product'),
            ]);
        } catch (\Exception $e) {
            Log::error('Batch update failed', ['id' => $batch->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar lote'], 500);
        }
    }

    public function destroy(Batch $batch): JsonResponse
    {
        $this->authorizeTenant($batch);

        if ($batch->stocks()->where('quantity', '>', 0)->exists()) {
            return response()->json(['message' => 'Não é possível excluir um lote com estoque ativo'], 422);
        }

        try {
            $batch->delete();
            return response()->json(['message' => 'Lote excluído com sucesso']);
        } catch (\Exception $e) {
            Log::error('Batch deletion failed', ['id' => $batch->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir lote'], 500);
        }
    }

    private function authorizeTenant(Batch $batch)
    {
        if ($batch->tenant_id !== app('current_tenant_id')) {
            abort(403);
        }
    }
}
