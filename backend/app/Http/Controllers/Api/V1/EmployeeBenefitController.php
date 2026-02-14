<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EmployeeBenefit;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EmployeeBenefitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $query = EmployeeBenefit::with('user');

            if ($request->has('user_id')) {
                $query->where('user_id', $request->user_id);
            }

            if ($request->has('type')) {
                $query->where('type', $request->type);
            }

            return response()->json($query->paginate(20));
        } catch (\Exception $e) {
            Log::error('EmployeeBenefit index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar benefícios'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'user_id' => 'required|exists:users,id',
                'type' => 'required|string',
                'provider' => 'nullable|string',
                'value' => 'required|numeric|min:0',
                'employee_contribution' => 'nullable|numeric|min:0',
                'start_date' => 'required|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'is_active' => 'boolean',
                'notes' => 'nullable|string',
            ]);

            $benefit = EmployeeBenefit::create($validated);

            DB::commit();
            return response()->json(['message' => 'Benefício criado com sucesso', 'data' => $benefit], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmployeeBenefit store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar benefício'], 500);
        }
    }

    public function show($id): JsonResponse
    {
        try {
            $benefit = EmployeeBenefit::with('user')->findOrFail($id);
            return response()->json(['data' => $benefit]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => 'Benefício não encontrado'], 404);
        } catch (\Exception $e) {
            Log::error('EmployeeBenefit show failed', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['message' => 'Erro ao buscar benefício'], 500);
        }
    }

    public function update(Request $request, $id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $benefit = EmployeeBenefit::findOrFail($id);

            $validated = $request->validate([
                'user_id' => 'exists:users,id',
                'type' => 'string',
                'provider' => 'nullable|string',
                'value' => 'numeric|min:0',
                'employee_contribution' => 'nullable|numeric|min:0',
                'start_date' => 'date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'is_active' => 'boolean',
                'notes' => 'nullable|string',
            ]);

            $benefit->update($validated);

            DB::commit();
            return response()->json(['message' => 'Benefício atualizado com sucesso', 'data' => $benefit]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Benefício não encontrado'], 404);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmployeeBenefit update failed', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['message' => 'Erro ao atualizar benefício'], 500);
        }
    }

    public function destroy($id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $benefit = EmployeeBenefit::findOrFail($id);
            $benefit->delete();

            DB::commit();
            return response()->json(['message' => 'Benefício excluído com sucesso']);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Benefício não encontrado'], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmployeeBenefit destroy failed', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['message' => 'Erro ao excluir benefício'], 500);
        }
    }
}
