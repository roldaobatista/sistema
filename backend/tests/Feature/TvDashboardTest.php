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
        Permission::firstOrCreate(['name' => 'tv.camera.manage']);
        $admin = Role::firstOrCreate(['name' => 'admin']);
        $admin->givePermissionTo(['tv.dashboard.view', 'tv.camera.manage']);
    }

    protected function createUserWithTvDashboard(): User
    {
        $tenant = \App\Models\Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id, 'current_tenant_id' => $tenant->id]);
        $user->assignRole('admin');
        return $user;
    }

    public function test_tv_dashboard_returns_correct_structure()
    {
        $user = $this->createUserWithTvDashboard();
        $tenantId = $user->current_tenant_id;

        Camera::create([
            'tenant_id' => $tenantId,
            'name' => 'Portaria',
            'stream_url' => 'rtsp://admin:123456@192.168.1.10:554/cam/realmonitor?channel=1&subtype=0',
            'is_active' => true,
            'position' => 1,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/tv/dashboard');

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

    public function test_tv_kpis_returns_structure()
    {
        $user = $this->createUserWithTvDashboard();

        $response = $this->actingAs($user)->getJson('/api/v1/tv/kpis');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'chamados_hoje', 'os_hoje', 'os_em_execucao', 'os_finalizadas',
                'tecnicos_online', 'tecnicos_em_campo', 'tecnicos_total',
            ]);
    }

    public function test_tv_alerts_returns_array()
    {
        $user = $this->createUserWithTvDashboard();

        $response = $this->actingAs($user)->getJson('/api/v1/tv/alerts');

        $response->assertStatus(200)->assertJsonStructure(['alerts']);
    }

    public function test_tv_cameras_index_returns_cameras()
    {
        $user = $this->createUserWithTvDashboard();
        Camera::create([
            'tenant_id' => $user->current_tenant_id,
            'name' => 'Recepção',
            'stream_url' => 'rtsp://192.168.1.1/stream',
            'is_active' => true,
            'position' => 0,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/tv/cameras');

        $response->assertStatus(200)
            ->assertJsonStructure(['cameras' => [['id', 'name', 'stream_url', 'is_active', 'position']]])
            ->assertJsonPath('cameras.0.name', 'Recepção');
    }

    public function test_tv_cameras_store_creates_camera()
    {
        $user = $this->createUserWithTvDashboard();

        $response = $this->actingAs($user)->postJson('/api/v1/tv/cameras', [
            'name' => 'Nova Câmera',
            'stream_url' => 'rtsp://192.168.1.2/stream',
            'location' => 'Galpão A',
            'is_active' => true,
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['camera' => ['id', 'name', 'stream_url', 'tenant_id']])
            ->assertJsonPath('camera.name', 'Nova Câmera');

        $this->assertDatabaseHas('cameras', ['name' => 'Nova Câmera', 'stream_url' => 'rtsp://192.168.1.2/stream']);
    }
}
