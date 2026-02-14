<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserLocationStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_location()
    {
        $tenant = \App\Models\Tenant::factory()->create();
        $user = User::factory()->create();
        $user->tenants()->attach($tenant->id);
        $user->update(['current_tenant_id' => $tenant->id]);

        \Illuminate\Support\Facades\Event::fake();

        $response = $this->actingAs($user)->postJson('/api/v1/user/location', [
            'latitude' => -23.550520,
            'longitude' => -46.633308,
        ]);

        \Illuminate\Support\Facades\Event::assertDispatched(\App\Events\TechnicianLocationUpdated::class);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Localização atualizada com sucesso.',
                'location' => [
                    'lat' => -23.550520,
                    'lng' => -46.633308,
                ]
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'location_lat' => -23.550520,
            'location_lng' => -46.633308,
        ]);
    }

    public function test_technician_status_changes_automatically_on_time_entry()
    {
        $tenant = \App\Models\Tenant::factory()->create();
        $user = User::factory()->create(['status' => 'available', 'tenant_id' => $tenant->id]);
        $user->tenants()->attach($tenant->id);

        $workOrder = WorkOrder::factory()->create(['tenant_id' => $tenant->id]);

        // 1. Start Travel -> Expect 'in_transit'
        $entry = TimeEntry::create([
            'tenant_id' => $user->tenant_id,
            'technician_id' => $user->id,
            'work_order_id' => $workOrder->id,
            'type' => TimeEntry::TYPE_TRAVEL,
            'started_at' => now(),
        ]);

        $this->assertEquals('in_transit', $user->fresh()->status);

        // 2. Stop Travel -> Expect 'available'
        $entry->update(['ended_at' => now()->addMinutes(30)]);
        $this->assertEquals('available', $user->fresh()->status);

        // 3. Start Work -> Expect 'working'
        $entry2 = TimeEntry::create([
            'tenant_id' => $user->tenant_id,
            'technician_id' => $user->id,
            'work_order_id' => $workOrder->id,
            'type' => TimeEntry::TYPE_WORK,
            'started_at' => now(),
        ]);

        $this->assertEquals('working', $user->fresh()->status);

        // 4. Stop Work -> Expect 'available'
        $entry2->update(['ended_at' => now()->addMinutes(60)]);
        $this->assertEquals('available', $user->fresh()->status);
    }
}
