<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Schedule;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TechnicianScheduleTimeEntryTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;

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
        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_schedule_store_rejects_foreign_tenant_relations(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);
        $foreignTechnician = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);
        $foreignWorkOrder = WorkOrder::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $foreignCustomer->id,
            'created_by' => $foreignTechnician->id,
        ]);

        $response = $this->postJson('/api/v1/schedules', [
            'work_order_id' => $foreignWorkOrder->id,
            'customer_id' => $foreignCustomer->id,
            'technician_id' => $foreignTechnician->id,
            'title' => 'Visita inválida',
            'scheduled_start' => now()->addDay()->format('Y-m-d H:i:s'),
            'scheduled_end' => now()->addDay()->addHour()->format('Y-m-d H:i:s'),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['work_order_id', 'customer_id', 'technician_id']);
    }

    public function test_time_entry_store_rejects_foreign_tenant_relations(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);
        $foreignTechnician = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);
        $foreignWorkOrder = WorkOrder::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $foreignCustomer->id,
            'created_by' => $foreignTechnician->id,
        ]);
        $foreignSchedule = Schedule::create([
            'tenant_id' => $otherTenant->id,
            'work_order_id' => $foreignWorkOrder->id,
            'customer_id' => $foreignCustomer->id,
            'technician_id' => $foreignTechnician->id,
            'title' => 'Agenda externa',
            'scheduled_start' => now()->subHour(),
            'scheduled_end' => now(),
            'status' => 'scheduled',
        ]);

        $response = $this->postJson('/api/v1/time-entries', [
            'work_order_id' => $foreignWorkOrder->id,
            'technician_id' => $foreignTechnician->id,
            'schedule_id' => $foreignSchedule->id,
            'started_at' => now()->subHour()->format('Y-m-d H:i:s'),
            'ended_at' => now()->format('Y-m-d H:i:s'),
            'type' => 'work',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['work_order_id', 'technician_id', 'schedule_id']);
    }
}

