<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Tenant;
use App\Models\WorkOrder;
use App\Models\Technician;

class TechSyncControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $techUser;
    private Tenant $tenant;
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        app()->instance('current_tenant_id', $this->tenant->id);

        $this->techUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);

        $permission = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'os.work_order.view', 'guard_name' => 'web']);
        $this->techUser->givePermissionTo($permission);

        $this->token = $this->techUser->createToken('test')->plainTextToken;
    }

    public function test_pull_returns_json_with_expected_keys(): void
    {
        $response = $this->withToken($this->token)
            ->getJson('/api/v1/tech/sync');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'work_orders',
                'equipment',
                'checklists',
                'standard_weights',
                'updated_at',
            ]);
    }

    public function test_pull_accepts_since_parameter(): void
    {
        $response = $this->withToken($this->token)
            ->getJson('/api/v1/tech/sync?since=2026-01-01T00:00:00Z');

        $response->assertStatus(200);
    }

    public function test_pull_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/tech/sync');
        $response->assertStatus(401);
    }

    public function test_batch_push_rejects_empty_mutations(): void
    {
        $response = $this->withToken($this->token)
            ->postJson('/api/v1/tech/sync/batch', [
                'mutations' => [],
            ]);

        // Laravel's 'required|array' rejects empty arrays
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['mutations']);
    }

    public function test_batch_push_validates_mutations_array(): void
    {
        $response = $this->withToken($this->token)
            ->postJson('/api/v1/tech/sync/batch', []);

        // mutations field is required — API returns 422
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['mutations']);
    }

    public function test_batch_push_processes_status_change(): void
    {
        // Create a work order assigned to the technician
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'status' => 'pending',
        ]);

        $response = $this->withToken($this->token)
            ->postJson('/api/v1/tech/sync/batch', [
                'mutations' => [
                    [
                        'type' => 'status_change',
                        'data' => [
                            'work_order_id' => $workOrder->id,
                            'to_status' => 'in_progress',
                            'changed_at' => now()->toISOString(),
                        ],
                    ],
                ],
            ]);

        $response->assertStatus(200);
    }

    public function test_batch_push_rejects_invalid_mutation_type(): void
    {
        $response = $this->withToken($this->token)
            ->postJson('/api/v1/tech/sync/batch', [
                'mutations' => [
                    [
                        'type' => 'invalid_type',
                        'data' => ['foo' => 'bar'],
                    ],
                ],
            ]);

        // Validation rejects invalid types (only checklist_response, expense, signature, status_change)
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['mutations.0.type']);
    }

    public function test_photo_upload_requires_file(): void
    {
        $response = $this->withToken($this->token)
            ->postJson('/api/v1/tech/sync/photo', [
                'work_order_id' => 1,
            ]);

        $response->assertStatus(422);
    }

    public function test_photo_upload_requires_authentication(): void
    {
        $response = $this->postJson('/api/v1/tech/sync/photo', [
            'work_order_id' => 1,
        ]);

        $response->assertStatus(401);
    }
}
