<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\Email;
use App\Models\EmailTag;
use App\Models\EmailActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EmailTagController extends Controller
{
    public function index(): JsonResponse
    {
        try {
            $tags = EmailTag::orderBy('name')->get();
            return response()->json($tags);
        } catch (\Exception $e) {
            Log::error('EmailTag index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar tags'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:50',
                'color' => 'required|string|max:20',
            ]);

            $tag = EmailTag::create($validated);

            DB::commit();
            return response()->json($tag, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmailTag store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar tag'], 500);
        }
    }

    public function update(Request $request, EmailTag $emailTag): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'sometimes|string|max:50',
                'color' => 'sometimes|string|max:20',
            ]);

            $emailTag->update($validated);

            DB::commit();
            return response()->json($emailTag);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmailTag update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar tag'], 500);
        }
    }

    public function destroy(EmailTag $emailTag): JsonResponse
    {
        try {
            $emailTag->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('EmailTag destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir tag'], 500);
        }
    }

    public function toggleTag(Request $request, Email $email, EmailTag $emailTag): JsonResponse
    {
        try {
            DB::beginTransaction();

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

            DB::commit();
            return response()->json(['attached' => count($attached['attached']) > 0]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmailTag toggleTag failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao alternar tag'], 500);
        }
    }
}
