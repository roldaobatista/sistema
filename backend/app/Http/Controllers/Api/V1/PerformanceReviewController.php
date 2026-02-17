<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Http\Controllers\Controller;
use App\Models\PerformanceReview;
use App\Models\ContinuousFeedback;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PerformanceReviewController extends Controller
{
    use ResolvesCurrentTenant;

    // Reviews
    public function indexReviews(): JsonResponse
    {
        try {
            $user = auth()->user();

            $query = PerformanceReview::with(['user:id,name', 'reviewer:id,name']);

            if (!$user->can('hr.performance.view_all')) {
                $query->where(function($q) use ($user) {
                    $q->where('user_id', $user->id)
                      ->orWhere('reviewer_id', $user->id);
                });
            }

            return response()->json($query->latest()->paginate(20));
        } catch (\Exception $e) {
            Log::error('PerformanceReview indexReviews failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar avaliações'], 500);
        }
    }

    public function storeReview(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'title' => 'required|string',
                'user_id' => 'required|exists:users,id',
                'reviewer_id' => 'required|exists:users,id',
                'cycle' => 'required|string',
                'deadline' => 'nullable|date',
                'year' => 'required|integer',
                'type' => 'required|in:180,360,manager,peer,self',
            ]);

            $review = PerformanceReview::create($validated + [
                'tenant_id' => $this->resolvedTenantId(),
                'status' => 'draft'
            ]);

            DB::commit();
            return response()->json(['message' => 'Avaliação criada', 'data' => $review], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('PerformanceReview storeReview failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar avaliação'], 500);
        }
    }

    public function showReview(PerformanceReview $review): JsonResponse
    {
        try {
            $this->authorizeReviewAccess($review);
            return response()->json($review->load(['user', 'reviewer']));
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => 'Sem permissão'], 403);
        } catch (\Exception $e) {
            Log::error('PerformanceReview showReview failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar avaliação'], 500);
        }
    }

    public function updateReview(Request $request, PerformanceReview $review): JsonResponse
    {
        try {
            DB::beginTransaction();

            $this->authorizeReviewAccess($review);

            $validated = $request->validate([
                'status' => 'sometimes|in:scheduled,in_progress,completed,canceled',
                'content' => 'nullable|array',
                'ratings' => 'nullable|array',
                'overall_rating' => 'nullable|numeric',
                'feedback_text' => 'nullable|string',
                'okrs' => 'nullable|array',
                'nine_box_potential' => 'nullable|integer',
                'nine_box_performance' => 'nullable|integer',
                'action_plan' => 'nullable|string',
            ]);

            if (isset($validated['status']) && $validated['status'] === 'completed') {
                $validated['completed_at'] = now();
            }

            $review->update($validated);

            DB::commit();
            return response()->json(['message' => 'Avaliação atualizada', 'data' => $review]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Sem permissão'], 403);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('PerformanceReview updateReview failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar avaliação'], 500);
        }
    }

    public function destroyReview(PerformanceReview $review): JsonResponse
    {
        try {
            $this->authorizeReviewAccess($review);

            if (!in_array($review->status, ['draft', 'canceled'])) {
                return response()->json(['message' => 'Apenas avaliações em rascunho ou canceladas podem ser excluídas'], 422);
            }

            $review->delete();

            return response()->json(['message' => 'Avaliação excluída com sucesso']);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => 'Sem permissão'], 403);
        } catch (\Exception $e) {
            Log::error('PerformanceReview destroyReview failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir avaliação'], 500);
        }
    }

    // Feedback
    public function indexFeedback(Request $request): JsonResponse
    {
        try {
            $user = auth()->user();
            $query = ContinuousFeedback::with(['fromUser:id,name,avatar', 'toUser:id,name,avatar']);

            $query->where(function($q) use ($user) {
                $q->where('to_user_id', $user->id)
                  ->orWhere('from_user_id', $user->id);
            });

            return response()->json($query->latest()->paginate(20));
        } catch (\Exception $e) {
            Log::error('PerformanceReview indexFeedback failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar feedbacks'], 500);
        }
    }

    public function storeFeedback(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'to_user_id' => 'required|exists:users,id',
                'content' => 'required|string',
                'type' => 'required|in:praise,suggestion,concern',
                'visibility' => 'required|in:public,private,manager_only',
            ]);

            $feedback = ContinuousFeedback::create($validated + [
                'from_user_id' => auth()->id(),
                'tenant_id' => $this->resolvedTenantId(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Feedback enviado', 'data' => $feedback], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('PerformanceReview storeFeedback failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao enviar feedback'], 500);
        }
    }

    // Helpers
    private function authorizeReviewAccess($review): void
    {
        $user = auth()->user();
        if ($user->can('hr.performance.view_all')) return;
        if ($review->user_id === $user->id) return;
        if ($review->reviewer_id === $user->id) return;

        abort(403, 'Unauthorized');
    }
}
