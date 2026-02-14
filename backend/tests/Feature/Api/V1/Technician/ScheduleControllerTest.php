<?php

namespace Tests\Feature\Api\V1\Technician;

use App\Models\User;
use App\Models\Tenant;
use App\Models\Schedule;
use App\Models\Customer;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;

class ScheduleControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Seed permissions
        Permission::firstOrCreate(['name' => 'technicians.schedule.view']);
        Permission::firstOrCreate(['name' => 'technicians.schedule.manage']);
    }

    public function test_can_list_schedules()
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->givePermissionTo('technicians.schedule.view');
        Sanctum::actingAs($user);

        Schedule::factory()->count(3)->create([
            'tenant_id' => $user->tenant_id,
            'technician_id' => User::factory()->create(['tenant_id' => $user->tenant_id])->id,
            'customer_id' => Customer::factory()->create(['tenant_id' => $user->tenant_id])->id,
        ]);

        $response = $this->getJson('/api/v1/schedules');

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_can_create_schedule()
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->givePermissionTo('technicians.schedule.manage');
        Sanctum::actingAs($user);

        $technician = User::factory()->create(['tenant_id' => $user->tenant_id]);
        $customer = Customer::factory()->create(['tenant_id' => $user->tenant_id]);

        $payload = [
            'technician_id' => $technician->id,
            'customer_id' => $customer->id,
            'title' => 'Visita Técnica',
            'scheduled_start' => now()->addDay()->setHour(9)->format('Y-m-d H:i'),
            'scheduled_end' => now()->addDay()->setHour(10)->format('Y-m-d H:i'),
            'status' => 'scheduled',
        ];

        $response = $this->postJson('/api/v1/schedules', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('title', 'Visita Técnica');
    }

    public function test_cannot_create_schedule_with_conflict()
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->givePermissionTo('technicians.schedule.manage');
        Sanctum::actingAs($user);

        $technician = User::factory()->create(['tenant_id' => $user->tenant_id]);
        $customer = Customer::factory()->create(['tenant_id' => $user->tenant_id]);

        // Existing schedule
        Schedule::factory()->create([
            'technician_id' => $technician->id,
            'customer_id' => $customer->id,
            'scheduled_start' => '2024-01-01 09:00:00',
            'scheduled_end' => '2024-01-01 10:00:00',
            'tenant_id' => $user->tenant_id,
        ]);

        // New conflicting schedule
        $payload = [
            'technician_id' => $technician->id,
            'customer_id' => $customer->id,
            'title' => 'Conflict',
            'scheduled_start' => '2024-01-01 09:30:00',
            'scheduled_end' => '2024-01-01 10:30:00',
            'status' => 'scheduled',
        ];

        $response = $this->postJson('/api/v1/schedules', $payload);

        $response->assertStatus(409)
            ->assertJson(['message' => 'Conflito de horário — técnico já possui agendamento neste período']);
    }

    public function test_can_update_schedule()
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->givePermissionTo('technicians.schedule.manage');
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create(['tenant_id' => $user->tenant_id]);
        $technician = User::factory()->create(['tenant_id' => $user->tenant_id]);

        $schedule = Schedule::factory()->create([
            'tenant_id' => $user->tenant_id,
            'technician_id' => $technician->id,
            'customer_id' => $customer->id,
        ]);

        $payload = [
            'title' => 'Updated Title',
        ];

        $response = $this->putJson("/api/v1/schedules/{$schedule->id}", $payload);

        $response->assertStatus(200)
            ->assertJsonPath('title', 'Updated Title');
    }

    public function test_unified_schedule_returns_correct_structure()
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->givePermissionTo('technicians.schedule.view');
        Sanctum::actingAs($user);

        $technician = User::factory()->create(['tenant_id' => $user->tenant_id]);
        $customer = Customer::factory()->create(['tenant_id' => $user->tenant_id]);
        
        // Create standard schedule
        Schedule::factory()->create([
            'technician_id' => $technician->id,
            'customer_id' => $customer->id,
            'scheduled_start' => now()->startOfWeek()->addDay()->setHour(10)->format('Y-m-d H:i:s'),
            'scheduled_end' => now()->startOfWeek()->addDay()->setHour(11)->format('Y-m-d H:i:s'),
            'tenant_id' => $user->tenant_id,
        ]);

        $from = now()->startOfWeek()->format('Y-m-d');
        $to = now()->endOfWeek()->format('Y-m-d');

        $response = $this->getJson("/api/v1/schedules-unified?from={$from}&to={$to}&technician_id={$technician->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'source',
                        'title',
                        'start',
                        'end',
                        'technician',
                    ]
                ]
            ]);
    }
}
