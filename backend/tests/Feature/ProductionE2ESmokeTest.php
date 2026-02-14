<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductionE2ESmokeTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_authenticated_me_endpoint_smoke(): void
    {
        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $tenant = Tenant::factory()->create();
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'current_tenant_id' => $tenant->id,
            'is_active' => true,
        ]);

        $user->tenants()->attach($tenant->id, ['is_default' => true]);

        Sanctum::actingAs($user, ['*']);

        $response = $this->getJson('/api/v1/me');

        $response->assertOk();
        $response->assertJsonPath('user.id', $user->id);
    }
}
