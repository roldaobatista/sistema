<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Schedule;
use App\Models\Tenant;
use App\Models\TimeEntry;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
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
            ->assertJsonValidationErrors(['work_order_id', 'customer_id']);
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
            ->assertJsonValidationErrors(['work_order_id', 'schedule_id']);
    }

    public function test_schedule_store_rejects_technician_without_tenant_membership(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignTechnician = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);

        $response = $this->postJson('/api/v1/schedules', [
            'customer_id' => $this->customer->id,
            'technician_id' => $foreignTechnician->id,
            'title' => 'Agenda tecnico externo',
            'scheduled_start' => now()->addDay()->format('Y-m-d H:i:s'),
            'scheduled_end' => now()->addDay()->addHour()->format('Y-m-d H:i:s'),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['technician_id']);
    }

    public function test_time_entry_store_rejects_technician_without_tenant_membership(): void
    {
        $otherTenant = Tenant::factory()->create();
        $foreignTechnician = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);

        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->postJson('/api/v1/time-entries', [
            'work_order_id' => $workOrder->id,
            'technician_id' => $foreignTechnician->id,
            'started_at' => now()->subHour()->format('Y-m-d H:i:s'),
            'ended_at' => now()->format('Y-m-d H:i:s'),
            'type' => TimeEntry::TYPE_WORK,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['technician_id']);
    }

    public function test_schedule_store_accepts_technician_linked_by_tenant_membership(): void
    {
        $otherTenant = Tenant::factory()->create();
        $sharedTechnician = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
            'is_active' => true,
        ]);
        $sharedTechnician->tenants()->attach($this->tenant->id, ['is_default' => false]);

        $response = $this->postJson('/api/v1/schedules', [
            'customer_id' => $this->customer->id,
            'technician_id' => $sharedTechnician->id,
            'title' => 'Agenda tecnico compartilhado',
            'scheduled_start' => now()->addDay()->format('Y-m-d H:i:s'),
            'scheduled_end' => now()->addDay()->addHour()->format('Y-m-d H:i:s'),
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('technician_id', $sharedTechnician->id);
    }

    public function test_time_entry_store_accepts_technician_linked_by_tenant_membership(): void
    {
        $otherTenant = Tenant::factory()->create();
        $sharedTechnician = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
            'is_active' => true,
        ]);
        $sharedTechnician->tenants()->attach($this->tenant->id, ['is_default' => false]);

        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->postJson('/api/v1/time-entries', [
            'work_order_id' => $workOrder->id,
            'technician_id' => $sharedTechnician->id,
            'started_at' => now()->subHour()->format('Y-m-d H:i:s'),
            'ended_at' => now()->format('Y-m-d H:i:s'),
            'type' => TimeEntry::TYPE_WORK,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('technician_id', $sharedTechnician->id);
    }

    public function test_schedule_store_accepts_explicit_status(): void
    {
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->postJson('/api/v1/schedules', [
            'work_order_id' => $workOrder->id,
            'customer_id' => $this->customer->id,
            'technician_id' => $this->user->id,
            'title' => 'Visita confirmada',
            'scheduled_start' => now()->addDay()->format('Y-m-d H:i:s'),
            'scheduled_end' => now()->addDay()->addHour()->format('Y-m-d H:i:s'),
            'status' => Schedule::STATUS_CONFIRMED,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', Schedule::STATUS_CONFIRMED);
    }

    public function test_time_entry_start_blocks_parallel_running_entries(): void
    {
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        TimeEntry::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrder->id,
            'technician_id' => $this->user->id,
            'started_at' => now()->subHour(),
            'ended_at' => null,
            'type' => TimeEntry::TYPE_WORK,
        ]);

        $response = $this->postJson('/api/v1/time-entries/start', [
            'work_order_id' => $workOrder->id,
            'type' => TimeEntry::TYPE_WORK,
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('message', 'Voce ja possui apontamento em andamento.');
    }

    public function test_time_entry_store_blocks_open_entry_when_running_exists(): void
    {
        $workOrderA = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $workOrderB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        TimeEntry::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrderA->id,
            'technician_id' => $this->user->id,
            'started_at' => now()->subHour(),
            'ended_at' => null,
            'type' => TimeEntry::TYPE_WORK,
        ]);

        $response = $this->postJson('/api/v1/time-entries', [
            'work_order_id' => $workOrderB->id,
            'technician_id' => $this->user->id,
            'started_at' => now()->format('Y-m-d H:i:s'),
            'type' => TimeEntry::TYPE_TRAVEL,
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('message', 'Tecnico ja possui apontamento em andamento.');
    }

    public function test_time_entry_stop_allows_super_admin_to_stop_other_technician_entry(): void
    {
        $workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $otherTechnician = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $entry = TimeEntry::create([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $workOrder->id,
            'technician_id' => $otherTechnician->id,
            'started_at' => now()->subHour(),
            'type' => TimeEntry::TYPE_WORK,
        ]);

        $this->user->assignRole(Role::firstOrCreate([
            'name' => 'super_admin',
            'guard_name' => 'web',
        ]));

        $response = $this->postJson("/api/v1/time-entries/{$entry->id}/stop");

        $response->assertOk();
        $this->assertNotNull($entry->fresh()->ended_at);
    }
}
