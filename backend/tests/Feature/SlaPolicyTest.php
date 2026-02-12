<?php

namespace Tests\Feature;

use App\Models\SlaPolicy;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SlaPolicyTest extends TestCase
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
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_index_returns_only_tenant_policies(): void
    {
        SlaPolicy::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'SLA Padrão',
            'response_time_minutes' => 60,
            'resolution_time_minutes' => 240,
            'priority' => 'medium',
            'is_active' => true,
        ]);

        $otherTenant = Tenant::factory()->create();
        SlaPolicy::create([
            'tenant_id' => $otherTenant->id,
            'name' => 'SLA Outro',
            'response_time_minutes' => 60,
            'resolution_time_minutes' => 240,
            'priority' => 'medium',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/sla-policies');

        $response->assertOk()
            ->assertJsonFragment(['name' => 'SLA Padrão'])
            ->assertJsonMissing(['name' => 'SLA Outro']);
    }

    public function test_store_creates_policy_for_current_tenant(): void
    {
        $payload = [
            'name' => 'SLA Crítico',
            'response_time_minutes' => 15,
            'resolution_time_minutes' => 60,
            'priority' => 'critical',
            'is_active' => true,
        ];

        $response = $this->postJson('/api/v1/sla-policies', $payload);

        $response->assertCreated()
            ->assertJsonFragment(['name' => 'SLA Crítico']);

        $this->assertDatabaseHas('sla_policies', [
            'tenant_id' => $this->tenant->id,
            'name' => 'SLA Crítico',
            'priority' => 'critical',
        ]);
    }

    public function test_show_policy(): void
    {
        $policy = SlaPolicy::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'SLA Teste',
            'response_time_minutes' => 30,
            'resolution_time_minutes' => 120,
            'priority' => 'high',
        ]);

        $response = $this->getJson("/api/v1/sla-policies/{$policy->id}");

        $response->assertOk()
            ->assertJsonPath('data.name', 'SLA Teste');
    }

    public function test_update_policy(): void
    {
        $policy = SlaPolicy::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'SLA Antigo',
            'response_time_minutes' => 30,
            'resolution_time_minutes' => 120,
            'priority' => 'low',
        ]);

        $response = $this->putJson("/api/v1/sla-policies/{$policy->id}", [
            'name' => 'SLA Novo',
            'priority' => 'high',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'SLA Novo');

        $this->assertDatabaseHas('sla_policies', [
            'id' => $policy->id,
            'name' => 'SLA Novo',
            'priority' => 'high',
        ]);
    }

    public function test_destroy_policy(): void
    {
        $policy = SlaPolicy::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'SLA Removível',
            'response_time_minutes' => 30,
            'resolution_time_minutes' => 120,
            'priority' => 'low',
        ]);

        $response = $this->deleteJson("/api/v1/sla-policies/{$policy->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('sla_policies', ['id' => $policy->id]);
    }

    public function test_cannot_access_other_tenant_policy(): void
    {
        $otherTenant = Tenant::factory()->create();
        $policy = SlaPolicy::create([
            'tenant_id' => $otherTenant->id,
            'name' => 'SLA Alheio',
            'response_time_minutes' => 30,
            'resolution_time_minutes' => 120,
            'priority' => 'low',
        ]);

        // Show
        $this->getJson("/api/v1/sla-policies/{$policy->id}")->assertNotFound();

        // Update
        $this->putJson("/api/v1/sla-policies/{$policy->id}", ['name' => 'Hacked'])->assertNotFound();

        // Destroy
        $this->deleteJson("/api/v1/sla-policies/{$policy->id}")->assertNotFound();
    }

    public function test_validation_fails_for_invalid_data(): void
    {
        $response = $this->postJson('/api/v1/sla-policies', [
            'name' => '', // Required
            'response_time_minutes' => -10, // Must be min 1
            'priority' => 'invalid_priority', // Enum invalid
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'response_time_minutes', 'priority']);
    }

    public function test_index_uses_current_tenant_when_user_switches_company(): void
    {
        $switchedTenant = Tenant::factory()->create();

        $this->user->update([
            'current_tenant_id' => $switchedTenant->id,
        ]);

        app()->instance('current_tenant_id', $switchedTenant->id);

        SlaPolicy::create([
            'tenant_id' => $switchedTenant->id,
            'name' => 'SLA Tenant Atual',
            'response_time_minutes' => 45,
            'resolution_time_minutes' => 180,
            'priority' => 'high',
            'is_active' => true,
        ]);

        SlaPolicy::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'SLA Tenant Base',
            'response_time_minutes' => 30,
            'resolution_time_minutes' => 120,
            'priority' => 'low',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/sla-policies');

        $response->assertOk()
            ->assertJsonFragment(['name' => 'SLA Tenant Atual'])
            ->assertJsonMissing(['name' => 'SLA Tenant Base']);
    }
}
