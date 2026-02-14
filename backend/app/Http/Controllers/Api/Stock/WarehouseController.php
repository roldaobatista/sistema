<?php

namespace App\Http\Controllers\Api\Stock;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WarehouseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $query = DB::table('warehouses')
                ->when($request->filled('search'), fn($q) => $q->where('name', 'like', "%{$request->search}%"))
                ->orderBy('name');

            return response()->json($query->paginate($request->input('per_page', 20)));
        } catch (\Exception $e) {
            Log::error('Warehouse index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar armazéns'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'code' => 'nullable|string|max:50',
                'address' => 'nullable|string|max:500',
                'is_active' => 'boolean',
            ]);

            $id = DB::table('warehouses')->insertGetId(array_merge($validated, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));

            DB::commit();

            $warehouse = DB::table('warehouses')->find($id);
            return response()->json(['message' => 'Armazém criado com sucesso', 'data' => $warehouse], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Warehouse store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar armazém'], 500);
        }
    }

    public function show(string $id): JsonResponse
    {
        try {
            $warehouse = DB::table('warehouses')->find($id);

            if (!$warehouse) {
                return response()->json(['message' => 'Armazém não encontrado'], 404);
            }

            return response()->json(['data' => $warehouse]);
        } catch (\Exception $e) {
            Log::error('Warehouse show failed', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['message' => 'Erro ao buscar armazém'], 500);
        }
    }

    public function update(Request $request, string $id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'sometimes|string|max:255',
                'code' => 'nullable|string|max:50',
                'address' => 'nullable|string|max:500',
                'is_active' => 'boolean',
            ]);

            $affected = DB::table('warehouses')->where('id', $id)->update(array_merge($validated, [
                'updated_at' => now(),
            ]));

            if ($affected === 0) {
                DB::rollBack();
                return response()->json(['message' => 'Armazém não encontrado'], 404);
            }

            DB::commit();

            $warehouse = DB::table('warehouses')->find($id);
            return response()->json(['message' => 'Armazém atualizado com sucesso', 'data' => $warehouse]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Warehouse update failed', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['message' => 'Erro ao atualizar armazém'], 500);
        }
    }

    public function destroy(string $id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $affected = DB::table('warehouses')->where('id', $id)->delete();

            if ($affected === 0) {
                DB::rollBack();
                return response()->json(['message' => 'Armazém não encontrado'], 404);
            }

            DB::commit();
            return response()->json(['message' => 'Armazém excluído com sucesso']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Warehouse destroy failed', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['message' => 'Erro ao excluir armazém'], 500);
        }
    }
}
