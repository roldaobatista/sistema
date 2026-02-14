<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Position;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class OrganizationController extends Controller
{
    // Departments
    public function indexDepartments(): JsonResponse
    {
        try {
            $departments = Department::with(['manager', 'parent', 'positions'])
                ->withCount('users')
                ->get();

            return response()->json($departments);
        } catch (\Exception $e) {
            Log::error('Organization indexDepartments failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar departamentos'], 500);
        }
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'parent_id' => 'nullable|exists:departments,id',
                'manager_id' => 'nullable|exists:users,id',
                'cost_center' => 'nullable|string',
            ]);

            $dept = Department::create($validated + ['tenant_id' => auth()->user()->tenant_id]);

            DB::commit();
            return response()->json(['message' => 'Departamento criado', 'data' => $dept], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Organization storeDepartment failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar departamento'], 500);
        }
    }

    public function updateDepartment(Request $request, Department $department): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'sometimes|string|max:255',
                'parent_id' => 'nullable|exists:departments,id',
                'manager_id' => 'nullable|exists:users,id',
                'cost_center' => 'nullable|string',
                'is_active' => 'boolean',
            ]);

            $department->update($validated);

            DB::commit();
            return response()->json(['message' => 'Departamento atualizado', 'data' => $department]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Organization updateDepartment failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar departamento'], 500);
        }
    }

    public function destroyDepartment(Department $department): JsonResponse
    {
        try {
            if ($department->children()->exists() || $department->users()->exists()) {
                return response()->json(['message' => 'Não é possível excluir departamento com filhos ou usuários'], 409);
            }

            $department->delete();
            return response()->json(['message' => 'Departamento excluído']);
        } catch (\Exception $e) {
            Log::error('Organization destroyDepartment failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir departamento'], 500);
        }
    }

    // Positions
    public function indexPositions(): JsonResponse
    {
        try {
            return response()->json(Position::with('department')->get());
        } catch (\Exception $e) {
            Log::error('Organization indexPositions failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar cargos'], 500);
        }
    }

    public function storePosition(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'department_id' => 'required|exists:departments,id',
                'level' => 'required|in:junior,pleno,senior,lead,manager,director,c-level',
                'description' => 'nullable|string',
            ]);

            $pos = Position::create($validated + ['tenant_id' => auth()->user()->tenant_id]);

            DB::commit();
            return response()->json(['message' => 'Cargo criado', 'data' => $pos], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Organization storePosition failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar cargo'], 500);
        }
    }

    public function updatePosition(Request $request, Position $position): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'sometimes|string|max:255',
                'department_id' => 'sometimes|exists:departments,id',
                'level' => 'sometimes|in:junior,pleno,senior,lead,manager,director,c-level',
                'description' => 'nullable|string',
                'is_active' => 'boolean',
            ]);

            $position->update($validated);

            DB::commit();
            return response()->json(['message' => 'Cargo atualizado', 'data' => $position]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Organization updatePosition failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar cargo'], 500);
        }
    }

    public function destroyPosition(Position $position): JsonResponse
    {
        try {
            if ($position->users()->exists()) {
                return response()->json(['message' => 'Não é possível excluir cargo com usuários vinculados'], 409);
            }

            $position->delete();
            return response()->json(['message' => 'Cargo excluído']);
        } catch (\Exception $e) {
            Log::error('Organization destroyPosition failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir cargo'], 500);
        }
    }

    // Org Chart Tree
    public function orgChart(): JsonResponse
    {
        try {
            $departments = Department::with(['manager', 'positions.users'])->get();
            return response()->json($departments);
        } catch (\Exception $e) {
            Log::error('Organization orgChart failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar organograma'], 500);
        }
    }
}
