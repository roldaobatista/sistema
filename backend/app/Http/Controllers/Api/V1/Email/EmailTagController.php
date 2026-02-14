<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\Email;
use App\Models\EmailTag;
use App\Models\EmailActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class EmailTagController extends Controller
{
    public function index(): JsonResponse
    {
        $tags = EmailTag::orderBy('name')->get();
        return response()->json($tags);
    }

    public function store(Request $request): JsonResponse
    {
        // Permission check: email.manage or email.admin
        // $this->authorize('create', EmailTag::class);

        $validated = $request->validate([
            'name' => 'required|string|max:50',
            'color' => 'required|string|max:20', // hex or tailwind class
        ]);

        $tag = EmailTag::create($validated);
        return response()->json($tag, 201);
    }

    public function update(Request $request, EmailTag $emailTag): JsonResponse
    {
         // $this->authorize('update', $emailTag);
        $validated = $request->validate([
            'name' => 'sometimes|string|max:50',
            'color' => 'sometimes|string|max:20',
        ]);

        $emailTag->update($validated);
        return response()->json($emailTag);
    }

    public function destroy(EmailTag $emailTag): JsonResponse
    {
         // $this->authorize('delete', $emailTag);
        $emailTag->delete();
        return response()->json(null, 204);
    }

    public function toggleTag(Request $request, Email $email, EmailTag $emailTag): JsonResponse
    {
        $this->authorize('view', $email);

        $attached = $email->tags()->toggle($emailTag->id);
        
        $action = count($attached['attached']) > 0 ? 'tag_added' : 'tag_removed';

        EmailActivity::create([
            'tenant_id' => $email->tenant_id,
            'email_id' => $email->id,
            'user_id' => auth()->id(),
            'type' => $action,
            'details' => ['tag_id' => $emailTag->id, 'tag_name' => $emailTag->name],
        ]);

        return response()->json(['attached' => count($attached['attached']) > 0]);
    }
}
