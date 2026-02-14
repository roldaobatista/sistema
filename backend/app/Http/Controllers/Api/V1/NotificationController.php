<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    /**
     * Listar notificacoes do usuario.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'limit' => 'nullable|integer|min:1|max:100',
            ]);

            $limit = max(1, min(100, (int) $request->input('limit', 30)));

            $notifications = Notification::where('user_id', $request->user()->id)
                ->orderByDesc('created_at')
                ->take($limit)
                ->get();

            $unreadCount = Notification::where('user_id', $request->user()->id)
                ->unread()
                ->count();

            return response()->json([
                'notifications' => $notifications,
                'unread_count' => $unreadCount,
            ]);
        } catch (\Exception $e) {
            Log::error('Notification index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar notificacoes'], 500);
        }
    }

    /**
     * Marcar uma notificacao como lida.
     */
    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        try {
            if ($notification->user_id !== $request->user()->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if (!$notification->read_at) {
                $notification->update(['read_at' => now()]);
            }

            return response()->json(['notification' => $notification]);
        } catch (\Exception $e) {
            Log::error('Notification markRead failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao marcar notificacao'], 500);
        }
    }

    /**
     * Marcar TODAS como lidas.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        try {
            $updated = Notification::where('user_id', $request->user()->id)
                ->unread()
                ->update(['read_at' => now()]);

            return response()->json(['success' => true, 'updated' => $updated]);
        } catch (\Exception $e) {
            Log::error('Notification markAllRead failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao marcar notificacoes'], 500);
        }
    }

    /**
     * Contar nao lidas (polling leve).
     */
    public function unreadCount(Request $request): JsonResponse
    {
        try {
            $count = Notification::where('user_id', $request->user()->id)
                ->unread()
                ->count();

            return response()->json(['unread_count' => $count]);
        } catch (\Exception $e) {
            Log::error('Notification unreadCount failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao contar notificacoes'], 500);
        }
    }
}
