<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;

/**
 * Web Push notification service.
 *
 * Uses the web-push-php library to send push notifications
 * to subscribed browsers/PWA installations.
 */
class WebPushService
{
    /**
     * Send a push notification to a specific user.
     */
    public function sendToUser(int $userId, string $title, string $body, array $data = []): int
    {
        $subscriptions = PushSubscription::forUser($userId)->get();

        return $this->sendToSubscriptions($subscriptions, $title, $body, $data);
    }

    /**
     * Send a push notification to all users in a tenant.
     */
    public function sendToTenant(int $tenantId, string $title, string $body, array $data = []): int
    {
        $subscriptions = PushSubscription::forTenant($tenantId)->get();

        return $this->sendToSubscriptions($subscriptions, $title, $body, $data);
    }

    /**
     * Send a push notification to users with a specific role in a tenant.
     */
    public function sendToRole(int $tenantId, string $role, string $title, string $body, array $data = []): int
    {
        $subscriptions = PushSubscription::forTenant($tenantId)
            ->whereHas('user', function ($q) use ($role) {
                $q->role($role);
            })
            ->get();

        return $this->sendToSubscriptions($subscriptions, $title, $body, $data);
    }

    /**
     * Send push notifications to a collection of subscriptions.
     */
    private function sendToSubscriptions($subscriptions, string $title, string $body, array $data = []): int
    {
        if ($subscriptions->isEmpty()) {
            return 0;
        }

        $vapidPublicKey = config('services.webpush.public_key');
        $vapidPrivateKey = config('services.webpush.private_key');
        $vapidSubject = config('services.webpush.subject', config('app.url'));

        if (!$vapidPublicKey || !$vapidPrivateKey) {
            Log::warning('VAPID keys not configured. Skipping push notifications.');
            return 0;
        }

        $payload = json_encode([
            'title' => $title,
            'body' => $body,
            'icon' => '/icons/icon-192.png',
            'badge' => '/icons/icon-192.png',
            'data' => array_merge($data, ['timestamp' => now()->toIso8601String()]),
        ]);

        $sent = 0;
        $expiredEndpoints = [];

        foreach ($subscriptions as $subscription) {
            try {
                $result = $this->sendRawPush(
                    $subscription->endpoint,
                    $subscription->p256dh_key,
                    $subscription->auth_key,
                    $payload,
                    $vapidPublicKey,
                    $vapidPrivateKey,
                    $vapidSubject
                );

                if ($result === true) {
                    $sent++;
                } elseif ($result === 'expired') {
                    $expiredEndpoints[] = $subscription->id;
                }
            } catch (\Exception $e) {
                Log::warning('Push notification failed', [
                    'subscription_id' => $subscription->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if (!empty($expiredEndpoints)) {
            PushSubscription::whereIn('id', $expiredEndpoints)->delete();
            Log::info('Cleaned up expired push subscriptions', ['count' => count($expiredEndpoints)]);
        }

        return $sent;
    }

    /**
     * Send a raw Web Push notification using cURL.
     *
     * This is a simplified implementation. For production, use the
     * `minishlink/web-push` Composer package for proper VAPID signing.
     *
     * @return bool|string true on success, 'expired' if endpoint gone, false on failure
     */
    private function sendRawPush(
        string $endpoint,
        string $p256dhKey,
        string $authKey,
        string $payload,
        string $vapidPublicKey,
        string $vapidPrivateKey,
        string $vapidSubject
    ): bool|string {
        // Check if minishlink/web-push is available
        if (class_exists(\Minishlink\WebPush\WebPush::class)) {
            return $this->sendWithLibrary(
                $endpoint, $p256dhKey, $authKey, $payload,
                $vapidPublicKey, $vapidPrivateKey, $vapidSubject
            );
        }

        // Fallback: log that the library is needed
        Log::warning('web-push-php library not installed. Run: composer require minishlink/web-push');
        return false;
    }

    /**
     * Send using minishlink/web-push library.
     */
    private function sendWithLibrary(
        string $endpoint,
        string $p256dhKey,
        string $authKey,
        string $payload,
        string $vapidPublicKey,
        string $vapidPrivateKey,
        string $vapidSubject
    ): bool|string {
        $auth = [
            'VAPID' => [
                'subject' => $vapidSubject,
                'publicKey' => $vapidPublicKey,
                'privateKey' => $vapidPrivateKey,
            ],
        ];

        $webPush = new \Minishlink\WebPush\WebPush($auth);

        $subscription = \Minishlink\WebPush\Subscription::create([
            'endpoint' => $endpoint,
            'publicKey' => $p256dhKey,
            'authToken' => $authKey,
        ]);

        $report = $webPush->sendOneNotification($subscription, $payload);

        if ($report->isSuccess()) {
            return true;
        }

        if ($report->isSubscriptionExpired()) {
            return 'expired';
        }

        Log::warning('Push send failed', [
            'endpoint' => $endpoint,
            'reason' => $report->getReason(),
        ]);

        return false;
    }
}
