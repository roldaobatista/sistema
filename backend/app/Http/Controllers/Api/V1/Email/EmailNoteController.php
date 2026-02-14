<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\Email;
use App\Models\EmailNote;
use App\Models\EmailActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class EmailNoteController extends Controller
{
    public function index(Email $email): JsonResponse
    {
        $this->authorize('view', $email);
        
        $notes = $email->notes()->with('user')->get();
        return response()->json($notes);
    }

    public function store(Request $request, Email $email): JsonResponse
    {
        $this->authorize('view', $email);

        $validated = $request->validate([
            'content' => 'required|string',
        ]);

        $note = $email->notes()->create([
            'user_id' => auth()->id(),
            'content' => $validated['content'],
            'tenant_id' => $email->tenant_id,
        ]);

        // Log activity
        EmailActivity::create([
            'tenant_id' => $email->tenant_id,
            'email_id' => $email->id,
            'user_id' => auth()->id(),
            'type' => 'note_added',
            'details' => ['note_id' => $note->id],
        ]);

        return response()->json($note->load('user'), 201);
    }

    public function destroy(EmailNote $emailNote): JsonResponse
    {
        if ($emailNote->user_id !== auth()->id()) {
             // Allow admin or email manager to delete? For now strict owner.
             abort(403);
        }
        
        $emailNote->delete();
        return response()->json(null, 204);
    }
}
