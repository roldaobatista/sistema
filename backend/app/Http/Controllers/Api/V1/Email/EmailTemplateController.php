<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\EmailTemplate;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EmailTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $templates = EmailTemplate::query()
                ->where(function ($query) {
                    $query->where('user_id', auth()->id())
                          ->orWhere('is_shared', true);
                })
                ->orderBy('name')
                ->get();

            return response()->json($templates);
        } catch (\Exception $e) {
            Log::error('EmailTemplate index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar templates'], 500);
        }
    }

    public function show(EmailTemplate $emailTemplate): JsonResponse
    {
        try {
            $this->authorize('view', $emailTemplate);
            return response()->json($emailTemplate);
        } catch (\Exception $e) {
            Log::error('EmailTemplate show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar template'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'subject' => 'nullable|string|max:255',
                'body' => 'required|string',
                'is_shared' => 'boolean',
            ]);

            $template = new EmailTemplate($validated);
            $template->user_id = auth()->id();

            if ($validated['is_shared'] ?? false) {
                $template->user_id = null;
            }

            $template->save();

            DB::commit();
            return response()->json($template, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmailTemplate store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar template'], 500);
        }
    }

    public function update(Request $request, EmailTemplate $emailTemplate): JsonResponse
    {
        try {
            DB::beginTransaction();

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

            DB::commit();
            return response()->json($emailTemplate);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('EmailTemplate update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar template'], 500);
        }
    }

    public function destroy(EmailTemplate $emailTemplate): JsonResponse
    {
        try {
            $this->authorize('delete', $emailTemplate);
            $emailTemplate->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('EmailTemplate destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir template'], 500);
        }
    }
}
