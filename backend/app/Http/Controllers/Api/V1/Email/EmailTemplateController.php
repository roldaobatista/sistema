<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\EmailTemplate;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class EmailTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $templates = EmailTemplate::query()
            ->where(function ($query) {
                $query->where('user_id', auth()->id())
                      ->orWhere('is_shared', true);
            })
            ->orderBy('name')
            ->get();

        return response()->json($templates);
    }

    public function show(EmailTemplate $emailTemplate): JsonResponse
    {
        $this->authorize('view', $emailTemplate);
        return response()->json($emailTemplate);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'subject' => 'nullable|string|max:255',
            'body' => 'required|string',
            'is_shared' => 'boolean',
        ]);

        $template = new EmailTemplate($validated);
        $template->user_id = auth()->id();
        
        // If shared, check if user has permission to share (e.g. admin)
        if ($validated['is_shared'] ?? false) {
             // For now, let's assume anyone can share, or we can restrict later
             // $this->authorize('share', EmailTemplate::class);
             $template->user_id = null; // System template
        }

        $template->save();

        return response()->json($template, 201);
    }

    public function update(Request $request, EmailTemplate $emailTemplate): JsonResponse
    {
        $this->authorize('update', $emailTemplate);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'subject' => 'nullable|string|max:255',
            'body' => 'sometimes|string',
            'is_shared' => 'boolean',
        ]);

        if (isset($validated['is_shared']) && $validated['is_shared']) {
            $emailTemplate->user_id = null;
        } else if (isset($validated['is_shared']) && !$validated['is_shared']) {
             $emailTemplate->user_id = auth()->id();
        }

        $emailTemplate->update($validated);

        return response()->json($emailTemplate);
    }

    public function destroy(EmailTemplate $emailTemplate): JsonResponse
    {
        $this->authorize('delete', $emailTemplate);
        $emailTemplate->delete();
        return response()->json(null, 204);
    }
}
