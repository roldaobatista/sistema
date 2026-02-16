<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ManagementReview;
use App\Models\ManagementReviewAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ManagementReviewController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $q = ManagementReview::where('tenant_id', $this->tenantId($request))
            ->with('creator:id,name')
            ->orderByDesc('meeting_date');
        if ($request->filled('year')) {
            $q->whereYear('meeting_date', $request->year);
        }
        return response()->json($q->paginate($request->input('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'meeting_date' => 'required|date',
            'title' => 'required|string|max:255',
            'participants' => 'nullable|string',
            'agenda' => 'nullable|string',
            'decisions' => 'nullable|string',
            'summary' => 'nullable|string',
            'actions' => 'nullable|array',
            'actions.*.description' => 'required_with:actions|string',
            'actions.*.responsible_id' => 'nullable|exists:users,id',
            'actions.*.due_date' => 'nullable|date',
        ]);

        $data['tenant_id'] = $this->tenantId($request);
        $data['created_by'] = $request->user()->id;
        $actions = $data['actions'] ?? [];
        unset($data['actions']);

        $review = DB::transaction(function () use ($data, $actions) {
            $review = ManagementReview::create($data);
            foreach ($actions as $i => $a) {
                ManagementReviewAction::create([
                    'management_review_id' => $review->id,
                    'description' => $a['description'],
                    'responsible_id' => $a['responsible_id'] ?? null,
                    'due_date' => $a['due_date'] ?? null,
                    'status' => 'pending',
                ]);
            }
            return $review->load('actions.responsible:id,name');
        });

        return response()->json(['message' => 'Revisão registrada', 'data' => $review], 201);
    }

    public function show(Request $request, ManagementReview $management_review): JsonResponse
    {
        if ($management_review->tenant_id !== $this->tenantId($request)) {
            abort(404);
        }
        $management_review->load(['creator:id,name', 'actions.responsible:id,name']);
        return response()->json(['data' => $management_review]);
    }

    public function update(Request $request, ManagementReview $management_review): JsonResponse
    {
        if ($management_review->tenant_id !== $this->tenantId($request)) {
            abort(404);
        }
        $data = $request->validate([
            'meeting_date' => 'sometimes|date',
            'title' => 'sometimes|string|max:255',
            'participants' => 'nullable|string',
            'agenda' => 'nullable|string',
            'decisions' => 'nullable|string',
            'summary' => 'nullable|string',
        ]);
        $management_review->update($data);
        return response()->json(['message' => 'Revisão atualizada', 'data' => $management_review->fresh(['creator:id,name', 'actions.responsible:id,name'])]);
    }

    public function destroy(Request $request, ManagementReview $management_review): JsonResponse
    {
        if ($management_review->tenant_id !== $this->tenantId($request)) {
            abort(404);
        }
        $management_review->delete();
        return response()->json(['message' => 'Revisão excluída']);
    }

    public function storeAction(Request $request, ManagementReview $management_review): JsonResponse
    {
        if ($management_review->tenant_id !== $this->tenantId($request)) {
            abort(404);
        }
        $data = $request->validate([
            'description' => 'required|string',
            'responsible_id' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
        ]);
        $data['management_review_id'] = $management_review->id;
        $data['status'] = 'pending';
        $action = ManagementReviewAction::create($data);
        $action->load('responsible:id,name');
        return response()->json(['message' => 'Ação adicionada', 'data' => $action], 201);
    }

    public function updateAction(Request $request, ManagementReviewAction $action): JsonResponse
    {
        $review = $action->review;
        if ($review->tenant_id !== $this->tenantId($request)) {
            abort(404);
        }
        $data = $request->validate([
            'description' => 'sometimes|string',
            'responsible_id' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
            'status' => 'nullable|in:pending,in_progress,completed',
            'notes' => 'nullable|string',
        ]);
        if (($data['status'] ?? null) === 'completed') {
            $data['completed_at'] = now()->toDateString();
        }
        $action->update($data);
        return response()->json(['message' => 'Ação atualizada', 'data' => $action->fresh('responsible:id,name')]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $tid = $this->tenantId($request);
        $reviews = ManagementReview::where('tenant_id', $tid)->orderByDesc('meeting_date')->limit(5)->get(['id', 'meeting_date', 'title']);
        $pendingActions = ManagementReviewAction::whereHas('review', fn ($q) => $q->where('tenant_id', $tid))
            ->where('status', '!=', 'completed')->count();
        return response()->json([
            'data' => [
                'recent_reviews' => $reviews,
                'pending_actions' => $pendingActions,
            ],
        ]);
    }
}
