<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\Email;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class EmailActivityController extends Controller
{
    public function index(Email $email): JsonResponse
    {
        try {
            $this->authorize('view', $email);

            $activities = $email->activities()
                ->with('user')
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json($activities);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['message' => 'Sem permissão'], 403);
        } catch (\Exception $e) {
            Log::error('EmailActivity index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar atividades'], 500);
        }
    }
}
