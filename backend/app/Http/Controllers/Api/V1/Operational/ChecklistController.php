<?php

namespace App\Http\Controllers\Api\V1\Operational;

use App\Http\Controllers\Controller;
use App\Models\Checklist;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChecklistController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $this->authorize('operational.checklists.view');
            
            $checklists = Checklist::query()
                ->when($request->boolean('active_only'), function ($query) {
                    $query->where('is_active', true);
                })
                ->get();

            return response()->json($checklists);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['message' => 'Sem permissão para acessar checklists'], 403);
        } catch (\Exception $e) {
            Log::error('Checklist index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar checklists'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $this->authorize('operational.checklists.create');

            \DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'description' => 'nullable|string',
                'items' => 'required|array',
                'items.*.id' => 'required|string',
                'items.*.text' => 'required|string',
                'items.*.type' => 'required|string|in:text,boolean,photo,select',
                'items.*.options' => 'nullable|array',
                'items.*.required' => 'boolean',
                'is_active' => 'boolean',
            ]);

            $checklist = Checklist::create($validated);

            \DB::commit();
            return response()->json(['message' => 'Checklist criado com sucesso', 'data' => $checklist], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \DB::rollBack();
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \DB::rollBack();
            \Log::error('Checklist store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno ao criar checklist'], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Checklist $checklist): JsonResponse
    {
        try {
            $this->authorize('operational.checklists.view');
            return response()->json($checklist);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erro ao visualizar checklist'], 500);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Checklist $checklist): JsonResponse
    {
        try {
            $this->authorize('operational.checklists.update');

            \DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'sometimes|string|max:255',
                'description' => 'nullable|string',
                'items' => 'sometimes|array',
                'items.*.id' => 'required_with:items|string',
                'items.*.text' => 'required_with:items|string',
                'items.*.type' => 'required_with:items|string|in:text,boolean,photo,select',
                'items.*.options' => 'nullable|array',
                'items.*.required' => 'boolean',
                'is_active' => 'boolean',
            ]);

            $checklist->update($validated);

            \DB::commit();
            return response()->json(['message' => 'Checklist atualizado com sucesso', 'data' => $checklist]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \DB::rollBack();
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \DB::rollBack();
            \Log::error('Checklist update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno ao atualizar checklist'], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Checklist $checklist): JsonResponse
    {
        try {
            $this->authorize('operational.checklists.delete');

            DB::beginTransaction();
            $checklist->delete();
            DB::commit();

            return response()->json(['message' => 'Checklist excluído com sucesso'], 200);
        } catch (\Exception $e) {
            \DB::rollBack();
            return response()->json(['message' => 'Erro ao excluir checklist'], 500);
        }
    }
}
