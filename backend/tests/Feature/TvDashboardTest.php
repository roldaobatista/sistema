<?php

namespace Tests\Feature;

use App\Models\Camera;
use App\Models\User;
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
        
        Permission::firstOrCreate(['name' => 'tv.dashboard.view']);
        $role = Role::firstOrCreate(['name' => 'admin']);
        $role->givePermissionTo('tv.dashboard.view');
    }

    public function test_tv_dashboard_returns_correct_structure()
    {
        // 1. Setup Tenant
        $tenant = \App\Models\Tenant::factory()->create();
        
        $user = User::factory()->create(['tenant_id' => $tenant->id, 'current_tenant_id' => $tenant->id]);
        $user->assignRole('admin');

        Camera::create([
            'tenant_id' => $tenant->id,
            'name' => 'Portaria',
            'stream_url' => 'rtsp://admin:123456@192.168.1.10:554/cam/realmonitor?channel=1&subtype=0',
            'is_active' => true,
            'position' => 1,
        ]);

        $response = $this->actingAs($user)
                         ->getJson('/api/v1/tv/dashboard');

        if ($response->status() !== 200) {
            dump($response->json());
        }

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
                             'os_finalizadas',
                             'tecnicos_online',
                             'tecnicos_em_campo',
                             'tecnicos_total',
                         ]
                     ]
                 ]);
    }

    public function test_tv_dashboard_requires_authentication()
    {
        $response = $this->getJson('/api/v1/tv/dashboard');
        $response->assertStatus(401);
    }
}
