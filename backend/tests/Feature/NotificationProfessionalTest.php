<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Notification tests — exact assertions for push subscription,
 * notification list, mark-read, and unread count.
 */
class NotificationProfessionalTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── LIST NOTIFICATIONS ──

    public function test_notifications_index_returns_list(): void
    {
        $response = $this->getJson('/api/v1/notifications');

        $response->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_unread_count_returns_correct_number(): void
    {
        // Create 3 unread notifications
        for ($i = 0; $i < 3; $i++) {
            $this->user->notifications()->create([
                'id' => \Illuminate\Support\Str::uuid(),
                'type' => 'App\\Notifications\\TestNotification',
                'data' => ['message' => "Notificação {$i}"],
            ]);
        }

        $response = $this->getJson('/api/v1/notifications/unread-count');

        $response->assertOk()
            ->assertJsonPath('count', 3);
    }

    // ── MARK READ ──

    public function test_mark_single_notification_read(): void
    {
        $notification = $this->user->notifications()->create([
            'id' => \Illuminate\Support\Str::uuid(),
            'type' => 'App\\Notifications\\TestNotification',
            'data' => ['message' => 'Para marcar como lida'],
        ]);

        $response = $this->putJson("/api/v1/notifications/{$notification->id}/read");

        $response->assertOk();

        $this->assertNotNull($notification->fresh()->read_at);
    }

    public function test_mark_all_read_clears_unread(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->user->notifications()->create([
                'id' => \Illuminate\Support\Str::uuid(),
                'type' => 'App\\Notifications\\TestNotification',
                'data' => ['message' => "Notificação {$i}"],
            ]);
        }

        $response = $this->putJson('/api/v1/notifications/read-all');

        $response->assertOk();

        $unread = $this->user->unreadNotifications()->count();
        $this->assertEquals(0, $unread);
    }

    // ── PUSH SUBSCRIPTION ──

    public function test_subscribe_push_persists(): void
    {
        $response = $this->postJson('/api/v1/push-subscriptions', [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/test-token-123',
            'keys' => [
                'p256dh' => 'test-p256dh-key',
                'auth' => 'test-auth-key',
            ],
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('push_subscriptions', [
            'user_id' => $this->user->id,
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/test-token-123',
        ]);
    }

    public function test_unsubscribe_push_removes_subscription(): void
    {
        // First subscribe
        $this->postJson('/api/v1/push-subscriptions', [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/to-remove',
            'keys' => [
                'p256dh' => 'test-key',
                'auth' => 'test-auth',
            ],
        ])->assertStatus(201);

        // Then unsubscribe
        $response = $this->deleteJson('/api/v1/push-subscriptions', [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/to-remove',
        ]);

        $response->assertOk();

        $this->assertDatabaseMissing('push_subscriptions', [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/to-remove',
        ]);
    }
}
