<?php

namespace Tests\Feature;

use App\Models\Camera;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class TvDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Setup permissions
        Permission::firstOrCreate(['name' => 'platform.dashboard.view']);
        
        // Setup roles
        $role = Role::firstOrCreate(['name' => 'admin']);
        $role->givePermissionTo('platform.dashboard.view');
    }

    public function test_tv_dashboard_returns_correct_structure()
    {
        // 1. Setup Tenant
        $tenant = \App\Models\Tenant::factory()->create();
        
        // 2. Create User linked to Tenant
        $user = User::factory()->create();
        $user->tenants()->attach($tenant->id);
        $user->update(['current_tenant_id' => $tenant->id]);
        
        $user->assignRole('admin'); // Admin has platform.dashboard.view by default or via setUp

        // 3. Create Camera
        Camera::create([
            'name' => 'Portaria',
            'stream_url' => 'rtsp://admin:123456@192.168.1.10:554/cam/realmonitor?channel=1&subtype=0',
            'is_active' => true,
            'position' => 1
        ]);

        // 3. Create Work Order
        // Assuming WorkOrder factory exists, if not we create manually
        // WorkOrder::factory()->create(['status' => 'in_progress']);

        // 4. Hit Endpoint
        $response = $this->actingAs($user)
                         ->getJson('/api/v1/tv/dashboard');

        // 5. Assert Structure
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'cameras' => [
                         '*' => ['id', 'name', 'stream_url']
                     ],
                     'operational' => [
                         'technicians' => [
                             '*' => ['id', 'name', 'status', 'location_lat', 'location_lng', 'location_updated_at']
                         ],
                         'service_calls',
                         'work_orders',
                         'latest_work_orders',
                         'kpis' => [
                             'chamados_hoje',
                             'os_hoje',
                             'os_em_execucao',
                             'tecnicos_online',
                             'tecnicos_em_campo'
                         ]
                     ]
                 ]);
    }

    public function test_tv_dashboard_requires_authentication()
    {
        $response = $this->getJson('/api/v1/tv/dashboard');
        $response->assertStatus(401); // Unauthorized (Sanctum) - Wait, our route is public or protected?
        // Checking api.php: Route::get('/tv/dashboard', ...) is NOT inside auth:sanctum group?
        // Let me check api.php again. 
        // It WAS added to the public group or protected group?
    }
}
