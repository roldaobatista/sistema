<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JobPosting;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class JobPostingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $query = JobPosting::with(['department', 'position']);

            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('department_id')) {
                $query->where('department_id', $request->department_id);
            }

            return response()->json($query->paginate(15));
        } catch (\Exception $e) {
            Log::error('JobPosting index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar vagas'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'department_id' => 'nullable|exists:departments,id',
                'position_id' => 'nullable|exists:positions,id',
                'description' => 'required|string',
                'requirements' => 'nullable|string',
                'salary_range_min' => 'nullable|numeric|min:0',
                'salary_range_max' => 'nullable|numeric|gte:salary_range_min',
                'status' => 'required|in:open,closed,on_hold',
                'opened_at' => 'nullable|date',
                'closed_at' => 'nullable|date|after_or_equal:opened_at',
            ]);

            $jobPosting = JobPosting::create($validated);

            DB::commit();
            return response()->json(['message' => 'Vaga criada', 'data' => $jobPosting], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('JobPosting store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar vaga'], 500);
        }
    }

    public function show(JobPosting $jobPosting): JsonResponse
    {
        try {
            return response()->json($jobPosting->load(['department', 'position', 'candidates']));
        } catch (\Exception $e) {
            Log::error('JobPosting show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar vaga'], 500);
        }
    }

    public function update(Request $request, JobPosting $jobPosting): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'department_id' => 'nullable|exists:departments,id',
                'position_id' => 'nullable|exists:positions,id',
                'description' => 'sometimes|string',
                'requirements' => 'nullable|string',
                'salary_range_min' => 'nullable|numeric|min:0',
                'salary_range_max' => 'nullable|numeric|gte:salary_range_min',
                'status' => 'sometimes|in:open,closed,on_hold',
                'opened_at' => 'nullable|date',
                'closed_at' => 'nullable|date|after_or_equal:opened_at',
            ]);

            $jobPosting->update($validated);

            DB::commit();
            return response()->json(['message' => 'Vaga atualizada', 'data' => $jobPosting]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('JobPosting update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar vaga'], 500);
        }
    }

    public function destroy(JobPosting $jobPosting): JsonResponse
    {
        try {
            $jobPosting->delete();
            return response()->json(['message' => 'Vaga excluída']);
        } catch (\Exception $e) {
            Log::error('JobPosting destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir vaga'], 500);
        }
    }

    public function candidates(JobPosting $jobPosting): JsonResponse
    {
        try {
            return response()->json($jobPosting->candidates()->orderBy('created_at', 'desc')->get());
        } catch (\Exception $e) {
            Log::error('JobPosting candidates failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar candidatos'], 500);
        }
    }

    public function storeCandidate(Request $request, JobPosting $jobPosting): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|email|max:255',
                'phone' => 'nullable|string|max:20',
                'resume_path' => 'nullable|string',
                'stage' => 'required|in:applied,screening,interview,technical_test,offer,hired,rejected',
                'notes' => 'nullable|string',
                'rating' => 'nullable|integer|min:1|max:5',
            ]);

            $candidate = $jobPosting->candidates()->create($validated);

            DB::commit();
            return response()->json(['message' => 'Candidato adicionado', 'data' => $candidate], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('JobPosting storeCandidate failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao adicionar candidato'], 500);
        }
    }

    public function updateCandidate(Request $request, \App\Models\Candidate $candidate): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'sometimes|string|max:255',
                'email' => 'sometimes|email|max:255',
                'phone' => 'nullable|string|max:20',
                'resume_path' => 'nullable|string',
                'stage' => 'sometimes|in:applied,screening,interview,technical_test,offer,hired,rejected',
                'notes' => 'nullable|string',
                'rating' => 'nullable|integer|min:1|max:5',
                'rejected_reason' => 'nullable|string',
            ]);

            $candidate->update($validated);

            DB::commit();
            return response()->json(['message' => 'Candidato atualizado', 'data' => $candidate]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('JobPosting updateCandidate failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar candidato'], 500);
        }
    }
}
