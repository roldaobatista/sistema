<?php

namespace Tests\Feature;

use App\Models\ServiceCall;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TechnicianUnifiedAgendaTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private User $technician;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
        $this->technician = User::factory()->create(['tenant_id' => $this->tenant->id]);
        
        $this->user->tenants()->attach($this->tenant->id);
        $this->technician->tenants()->attach($this->tenant->id);

        // Create permissions
        \Spatie\Permission\Models\Permission::create(['name' => 'technicians.schedule.view', 'guard_name' => 'web']);
        \Spatie\Permission\Models\Permission::create(['name' => 'technicians.schedule.manage', 'guard_name' => 'web']);
        
        $this->user->givePermissionTo('technicians.schedule.view');
        $this->user->givePermissionTo('technicians.schedule.manage');

        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_unified_endpoint_returns_schedules_and_service_calls(): void
    {
        // Create a Schedule
        $schedule = Schedule::factory()->create([
            'tenant_id' => $this->tenant->id,
            'technician_id' => $this->technician->id,
            'scheduled_start' => now()->addDay()->setHour(10)->setMinute(0),
            'scheduled_end' => now()->addDay()->setHour(12)->setMinute(0),
            'title' => 'Install Device',
        ]);

        // Create a Service Call (Chamado)
        $call = ServiceCall::factory()->create([
            'tenant_id' => $this->tenant->id,
            'technician_id' => $this->technician->id,
            'scheduled_date' => now()->addDay()->setHour(14)->setMinute(0),
            'call_number' => 'CH-123',
            'observations' => 'Fix broken cable',
            'status' => ServiceCall::STATUS_OPEN,
        ]);

        $from = now()->toDateString();
        $to = now()->addDays(2)->toDateString();

        $response = $this->getJson("/api/v1/schedules-unified?technician_id={$this->technician->id}&from={$from}&to={$to}");

        $response->assertOk();
        $data = $response->json('data');

        // Check if both items are present
        $this->assertCount(2, $data);

        // Verify Schedule
        $scheduleItem = collect($data)->firstWhere('source', 'schedule');
        $this->assertNotNull($scheduleItem);
        $this->assertEquals($schedule->id, $scheduleItem['id']);
        $this->assertEquals('Install Device', $scheduleItem['title']);

        // Verify Service Call
        $callItem = collect($data)->firstWhere('source', 'service_call');
        $this->assertNotNull($callItem);
        $this->assertEquals("call-{$call->id}", $callItem['id']);
        $this->assertEquals("Chamado #{$call->call_number}", $callItem['title']);
        
        // Compare as ISO strings to avoid object vs string mismatch
        $this->assertEquals($call->scheduled_date->toISOString(), $callItem['start']);
    }
}
