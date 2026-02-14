<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Skill;
use App\Models\SkillRequirement;
use App\Models\UserSkill;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SkillsController extends Controller
{
    public function index(): JsonResponse
    {
        try {
            return response()->json(Skill::all());
        } catch (\Exception $e) {
            Log::error('Skills index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar competências'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string',
                'category' => 'nullable|string',
                'description' => 'nullable|string',
            ]);

            $skill = Skill::create($validated + ['tenant_id' => auth()->user()->tenant_id]);

            DB::commit();
            return response()->json(['message' => 'Competência criada', 'data' => $skill], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Skills store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar competência'], 500);
        }
    }

    public function update(Request $request, Skill $skill): JsonResponse
    {
        try {
            DB::beginTransaction();

            $skill->update($request->validate([
                'name' => 'string',
                'category' => 'nullable|string',
                'description' => 'nullable|string',
            ]));

            DB::commit();
            return response()->json(['message' => 'Competência atualizada', 'data' => $skill]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Skills update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar competência'], 500);
        }
    }

    public function destroy(Skill $skill): JsonResponse
    {
        try {
            $skill->delete();
            return response()->json(['message' => 'Competência excluída']);
        } catch (\Exception $e) {
            Log::error('Skills destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir competência'], 500);
        }
    }

    public function matrix(): JsonResponse
    {
        try {
            $users = \App\Models\User::where('tenant_id', auth()->user()->tenant_id)
                ->with(['position.skillRequirements.skill', 'skills'])
                ->get()
                ->map(function ($user) {
                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'position' => $user->position ? $user->position->name : null,
                        'requirements' => $user->position ? $user->position->skillRequirements->map(function ($req) {
                            return [
                                'skill_id' => $req->skill_id,
                                'skill_name' => $req->skill->name,
                                'required' => $req->required_level,
                            ];
                        }) : [],
                        'skills' => $user->skills->map(function ($s) {
                            return [
                                'skill_id' => $s->skill_id,
                                'current' => $s->current_level,
                                'assessed_at' => $s->assessed_at,
                            ];
                        }),
                    ];
                });

            return response()->json($users);
        } catch (\Exception $e) {
            Log::error('Skills matrix failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar matriz de competências'], 500);
        }
    }

    public function assessUser(Request $request, $userId): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'skill_id' => 'required|exists:skills,id',
                'level' => 'required|integer|min:1|max:5',
            ]);

            $us = UserSkill::updateOrCreate(
                ['user_id' => $userId, 'skill_id' => $validated['skill_id']],
                [
                    'current_level' => $validated['level'],
                    'assessed_at' => now(),
                    'assessed_by' => auth()->id(),
                ]
            );

            DB::commit();
            return response()->json(['message' => 'Avaliação registrada', 'data' => $us]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Skills assessUser failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao avaliar competência'], 500);
        }
    }
}
