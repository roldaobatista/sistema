<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PushSubscriptionController extends Controller
{
    /**
     * Subscribe to push notifications.
     */
    public function subscribe(Request $request): JsonResponse
    {
        $request->validate([
            'endpoint' => 'required|url|max:2000',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
        ]);

        try {
            $user = $request->user();

            $subscription = PushSubscription::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'endpoint' => $request->input('endpoint'),
                ],
                [
                    'tenant_id' => $user->current_tenant_id,
                    'p256dh_key' => $request->input('keys.p256dh'),
                    'auth_key' => $request->input('keys.auth'),
                    'user_agent' => $request->userAgent(),
                ]
            );

            return response()->json([
                'message' => 'Inscrição de push registrada com sucesso',
                'data' => ['id' => $subscription->id],
            ], 201);

        } catch (\Exception $e) {
            Log::error('Push subscribe failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar inscrição'], 500);
        }
    }

    /**
     * Unsubscribe from push notifications.
     */
    public function unsubscribe(Request $request): JsonResponse
    {
        $request->validate([
            'endpoint' => 'required|url|max:2000',
        ]);

        $deleted = PushSubscription::where('user_id', $request->user()->id)
            ->where('endpoint', $request->input('endpoint'))
            ->delete();

        if ($deleted) {
            return response()->json(['message' => 'Inscrição removida com sucesso']);
        }

        return response()->json(['message' => 'Inscrição não encontrada'], 404);
    }

    /**
     * Send a test push notification.
     */
    public function test(Request $request, WebPushService $pushService): JsonResponse
    {
        $user = $request->user();

        $sent = $pushService->sendToUser(
            $user->id,
            'Notificação de teste',
            'Esta é uma notificação de teste do sistema Kalibrium.',
            ['type' => 'test', 'url' => '/']
        );

        return response()->json([
            'message' => $sent > 0
                ? "Notificação enviada para {$sent} dispositivo(s)"
                : 'Nenhum dispositivo inscrito encontrado',
            'sent' => $sent,
        ]);
    }

    /**
     * Get VAPID public key for the frontend.
     */
    public function vapidKey(): JsonResponse
    {
        $publicKey = config('services.webpush.public_key');

        if (!$publicKey) {
            return response()->json(['message' => 'VAPID key não configurada'], 503);
        }

        return response()->json(['publicKey' => $publicKey]);
    }
}
