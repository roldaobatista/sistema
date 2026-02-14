<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use App\Models\PerformanceReview;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use Laravel\Sanctum\Sanctum;

class PerformanceReviewTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $user;
    protected $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create Tenant
        $this->tenant = \App\Models\Tenant::factory()->create();
        
        // Create User belonging to Tenant
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id
        ]);
        
        $this->setupPermissions();
    }

    protected function setupPermissions()
    {
        try {
            // Create permissions if they don't exist
            $view = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'hr.performance.view', 'guard_name' => 'web']);
            $manage = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'hr.performance.manage', 'guard_name' => 'web']);
            
            // Assign to user
            $this->user->givePermissionTo($view);
            $this->user->givePermissionTo($manage);
        } catch (\Throwable $e) {
            // Fallback if Spatie is not installed or configured as expected
        }
    }

    public function test_can_list_performance_reviews()
    {
        Sanctum::actingAs($this->user, ['*']);
        
        PerformanceReview::factory()->create([
            'user_id' => $this->user->id,
            'reviewer_id' => $this->user->id,
            'tenant_id' => $this->tenant->id,
            'cycle' => 'Q1 2026',
            'status' => 'draft'
        ]);

        $response = $this->getJson('/api/v1/hr/performance-reviews');

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'data' => [
                         '*' => ['id', 'user_id', 'reviewer_id', 'cycle', 'status']
                     ]
                 ]);
    }

    public function test_can_create_performance_review()
    {
        Sanctum::actingAs($this->user, ['*']);

        $data = [
            'user_id' => $this->user->id,
            'reviewer_id' => $this->user->id,
            'title' => 'Avaliação Q1 2026',
            'cycle' => 'Q1 2026',
            'type' => 'manager',
            'status' => 'draft',
            'year' => 2026,
            'tenant_id' => $this->tenant->id
        ];

        $response = $this->postJson('/api/v1/hr/performance-reviews', $data);

        $response->assertCreated()
                 ->assertJsonFragment(['cycle' => 'Q1 2026']);
                 
        $this->assertDatabaseHas('performance_reviews', [
            'cycle' => 'Q1 2026',
            'user_id' => $this->user->id
        ]);
    }
}
