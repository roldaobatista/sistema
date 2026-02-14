<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PerformanceReview;
use App\Models\ContinuousFeedback;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PerformanceReviewController extends Controller
{
    // Reviews
    public function indexReviews()
    {
        // List reviews where user is involved (as reviewee or reviewer)
        // Or if admin/manager, list all/team's
        $user = auth()->user();
        
        $query = PerformanceReview::with(['user:id,name', 'reviewer:id,name']);

        // Simple permission logic: view own
        // In real app, check 'hr.review.view_all' etc.
        if (!$user->can('hr.performance.view_all')) {
            $query->where(function($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('reviewer_id', $user->id);
            });
        }
        
        return $query->latest()->paginate(20);
    }

    public function storeReview(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'user_id' => 'required|exists:users,id',
            'reviewer_id' => 'required|exists:users,id',
            'cycle' => 'required|string',
            'deadline' => 'nullable|date',
            'year' => 'required|integer',
            'type' => 'required|in:180,360,manager,peer,self', // based on migration enum
        ]);

        $review = PerformanceReview::create($validated + [
            'tenant_id' => auth()->user()->tenant_id,
            'status' => 'draft'
        ]);

        return response()->json($review, 201);
    }

    public function showReview(PerformanceReview $review)
    {
        $this->authorizeReviewAccess($review);
        return $review->load(['user', 'reviewer']);
    }

    public function updateReview(Request $request, PerformanceReview $review)
    {
        $this->authorizeReviewAccess($review); // and verify edit rights
        
        // Only allow updating content/ratings if status is draft or scheduled or in-progress
        $validated = $request->validate([
            'status' => 'sometimes|in:scheduled,in_progress,completed,canceled',
            'content' => 'nullable|array',
            'ratings' => 'nullable|array',
            'overall_rating' => 'nullable|numeric',
            'feedback_text' => 'nullable|string',
            // New fields
            'okrs' => 'nullable|array',
            'nine_box_potential' => 'nullable|integer',
            'nine_box_performance' => 'nullable|integer',
            'action_plan' => 'nullable|string',
        ]);

        if (isset($validated['status']) && $validated['status'] === 'completed') {
            $validated['completed_at'] = now();
        }

        $review->update($validated);
        return response()->json($review);
    }

    public function destroyReview(PerformanceReview $review)
    {
        $this->authorizeReviewAccess($review);

        if (!in_array($review->status, ['draft', 'canceled'])) {
            return response()->json(['message' => 'Apenas avaliações em rascunho ou canceladas podem ser excluídas'], 422);
        }

        $review->delete();

        return response()->json(['message' => 'Avaliação excluída com sucesso']);
    }

    // Feedback
    public function indexFeedback(Request $request)
    {
        $user = auth()->user();
        $query = ContinuousFeedback::with(['fromUser:id,name,avatar', 'toUser:id,name,avatar']);
        
        // Show feedback sent OR received
        $query->where(function($q) use ($user) {
            $q->where('to_user_id', $user->id)
              ->orWhere('from_user_id', $user->id);
        });

        return $query->latest()->paginate(20);
    }

    public function storeFeedback(Request $request)
    {
        $validated = $request->validate([
            'to_user_id' => 'required|exists:users,id',
            'content' => 'required|string',
            'type' => 'required|in:praise,suggestion,concern',
            'visibility' => 'required|in:public,private,manager_only',
        ]);

        $feedback = ContinuousFeedback::create($validated + [
            'from_user_id' => auth()->id(),
            'tenant_id' => auth()->user()->tenant_id,
        ]);

        return response()->json($feedback, 201);
    }

    // Helpers
    private function authorizeReviewAccess($review)
    {
        $user = auth()->user();
        if ($user->can('hr.performance.view_all')) return;
        if ($review->user_id === $user->id) return;
        if ($review->reviewer_id === $user->id) return;
        
        abort(403, 'Unauthorized');
    }
}
