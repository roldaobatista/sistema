<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class WarehouseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Warehouse::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->boolean('active_only', true)) {
            $query->where('is_active', true);
        }

        $warehouses = $query->orderBy('name')->paginate($request->integer('per_page', 50));

        return response()->json($warehouses);
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'code' => 'required|string|max:50|unique:warehouses,code,NULL,id,tenant_id,' . app('current_tenant_id'),
                'type' => 'required|in:fixed,vehicle',
                'is_active' => 'boolean',
            ]);

            $warehouse = DB::transaction(fn () => Warehouse::create($validated));

            return response()->json([
                'message' => 'Armazém criado com sucesso.',
                'data' => $warehouse
            ], 201);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('WarehouseController::store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar armazém.'], 500);
        }
    }

    public function show(Warehouse $warehouse): JsonResponse
    {
        return response()->json([
            'data' => $warehouse
        ]);
    }

    public function update(Request $request, Warehouse $warehouse): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'string|max:255',
                'code' => 'string|max:50|unique:warehouses,code,' . $warehouse->id . ',id,tenant_id,' . app('current_tenant_id'),
                'type' => 'in:fixed,vehicle',
                'is_active' => 'boolean',
            ]);

            DB::transaction(fn () => $warehouse->update($validated));

            return response()->json([
                'message' => 'Armazém atualizado com sucesso.',
                'data' => $warehouse->fresh()
            ]);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('WarehouseController::update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar armazém.'], 500);
        }
    }

    public function destroy(Warehouse $warehouse): JsonResponse
    {
        try {
            // Check if there is stock
            if ($warehouse->stocks()->where('quantity', '>', 0)->exists()) {
                return response()->json([
                    'message' => 'Não é possível excluir um armazém que possui saldo de estoque.'
                ], 422);
            }

            DB::transaction(fn () => $warehouse->delete());

            return response()->json([
                'message' => 'Armazém excluído com sucesso.'
            ]);
        } catch (\Exception $e) {
            Log::error('WarehouseController::destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir armazém.'], 500);
        }
    }
}
