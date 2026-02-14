<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Notification CRUD + Push subscription + VAPID key.
 */
class NotificationPushTest extends TestCase
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
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);
        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_list_notifications(): void
    {
        $response = $this->getJson('/api/v1/notifications');
        $response->assertOk();
    }

    public function test_unread_count(): void
    {
        $response = $this->getJson('/api/v1/notifications/unread-count');
        $response->assertOk();
        $this->assertArrayHasKey('count', $response->json());
    }

    public function test_mark_all_as_read(): void
    {
        $response = $this->putJson('/api/v1/notifications/read-all');
        $response->assertOk();
    }

    public function test_vapid_key_endpoint(): void
    {
        $response = $this->getJson('/api/v1/push/vapid-key');
        $response->assertOk();
    }

    public function test_push_subscribe_requires_endpoint(): void
    {
        $response = $this->postJson('/api/v1/push/subscribe', []);
        $response->assertStatus(422);
    }

    public function test_push_subscribe_with_valid_data(): void
    {
        $response = $this->postJson('/api/v1/push/subscribe', [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
            'keys' => [
                'p256dh' => 'test-p256dh-key',
                'auth' => 'test-auth-key',
            ],
        ]);
        $response->assertCreated();
    }
}
