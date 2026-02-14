<?php

namespace Tests\Feature;

use App\Models\PushSubscription;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PushSubscriptionTest extends TestCase
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

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_subscribe_creates_push_subscription(): void
    {
        $payload = [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
            'keys' => [
                'p256dh' => 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfWI0',
                'auth'   => 'tBHItJI5svbpC7FYelT4vg',
            ],
        ];

        $response = $this->postJson('/api/v1/push/subscribe', $payload);

        $response->assertStatus(201)
            ->assertJsonStructure(['message', 'data' => ['id']]);

        $this->assertDatabaseHas('push_subscriptions', [
            'user_id'   => $this->user->id,
            'tenant_id' => $this->tenant->id,
            'endpoint'  => $payload['endpoint'],
        ]);
    }

    public function test_subscribe_replaces_existing_subscription_for_same_endpoint(): void
    {
        PushSubscription::create([
            'user_id'    => $this->user->id,
            'tenant_id'  => $this->tenant->id,
            'endpoint'   => 'https://fcm.googleapis.com/fcm/send/existing-endpoint',
            'p256dh_key' => 'old-key',
            'auth_key'   => 'old-auth',
        ]);

        $response = $this->postJson('/api/v1/push/subscribe', [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/existing-endpoint',
            'keys' => [
                'p256dh' => 'new-key-updated',
                'auth'   => 'new-auth-updated',
            ],
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseCount('push_subscriptions', 1);
        $this->assertDatabaseHas('push_subscriptions', [
            'endpoint'   => 'https://fcm.googleapis.com/fcm/send/existing-endpoint',
            'p256dh_key' => 'new-key-updated',
        ]);
    }

    public function test_unsubscribe_deletes_subscription(): void
    {
        PushSubscription::create([
            'user_id'    => $this->user->id,
            'tenant_id'  => $this->tenant->id,
            'endpoint'   => 'https://fcm.googleapis.com/fcm/send/to-remove',
            'p256dh_key' => 'key',
            'auth_key'   => 'auth',
        ]);

        $response = $this->deleteJson('/api/v1/push/unsubscribe', [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/to-remove',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseMissing('push_subscriptions', [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/to-remove',
        ]);
    }

    public function test_vapid_key_returns_public_key(): void
    {
        config(['services.webpush.public_key' => 'test-vapid-public-key-12345']);

        $response = $this->getJson('/api/v1/push/vapid-key');

        $response->assertOk()
            ->assertJsonPath('publicKey', 'test-vapid-public-key-12345');
    }

    public function test_subscribe_requires_endpoint(): void
    {
        $response = $this->postJson('/api/v1/push/subscribe', [
            'keys' => ['p256dh' => 'key', 'auth' => 'auth'],
        ]);

        $response->assertStatus(422);
    }

    public function test_subscribe_requires_keys(): void
    {
        $response = $this->postJson('/api/v1/push/subscribe', [
            'endpoint' => 'https://example.com/push',
        ]);

        $response->assertStatus(422);
    }
}
