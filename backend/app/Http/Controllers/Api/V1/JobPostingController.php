<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JobPosting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class JobPostingController extends Controller
{
    public function index(Request $request)
    {
        $query = JobPosting::with(['department', 'position']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        return response()->json($query->paginate(15));
    }

    public function store(Request $request)
    {
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

        return response()->json($jobPosting, 201);
    }

    public function show(JobPosting $jobPosting)
    {
        return response()->json($jobPosting->load(['department', 'position', 'candidates']));
    }

    public function update(Request $request, JobPosting $jobPosting)
    {
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

        return response()->json($jobPosting);
    }

    public function destroy(JobPosting $jobPosting)
    {
        $jobPosting->delete();
        return response()->json(null, 204);
    }

    public function candidates(JobPosting $jobPosting)
    {
        return response()->json($jobPosting->candidates()->orderBy('created_at', 'desc')->get());
    }

    public function storeCandidate(Request $request, JobPosting $jobPosting)
    {
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

        return response()->json($candidate, 201);
    }

    public function updateCandidate(Request $request, \App\Models\Candidate $candidate)
    {
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

        return response()->json($candidate);
    }
}
