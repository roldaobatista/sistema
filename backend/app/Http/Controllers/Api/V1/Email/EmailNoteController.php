<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\Email;
use App\Models\EmailNote;
use App\Models\EmailActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EmailNoteController extends Controller
{
    public function index(Email $email): JsonResponse
    {
        try {
            $this->authorize('view', $email);
            $notes = $email->notes()->with('user')->get();
            return response()->json($notes);
        } catch (\Exception $e) {
            Log::error('EmailNote index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar notas'], 500);
        }
    }

    public function store(Request $request, Email $email): JsonResponse
    {
        try {
            DB::beginTransaction();

            $this->authorize('view', $email);

            $validated = $request->validate([
                'content' => 'required|string',
            ]);

            $note = $email->notes()->create([
                'user_id' => auth()->id(),
                'content' => $validated['content'],
                'tenant_id' => $email->tenant_id,
            ]);

            EmailActivity::create([
                'tenant_id' => $email->tenant_id,
                'email_id' => $email->id,
                'user_id' => auth()->id(),
                'type' => 'note_added',
                'details' => ['note_id' => $note->id],
            ]);

            DB::commit();
            return response()->json($note->load('user'), 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmailNote store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar nota'], 500);
        }
    }

    public function destroy(EmailNote $emailNote): JsonResponse
    {
        try {
            if ($emailNote->user_id !== auth()->id()) {
                abort(403);
            }

            $emailNote->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('EmailNote destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir nota'], 500);
        }
    }
}
