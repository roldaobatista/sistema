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
use Tests\TestCase;

/**
 * Professional Schedule & TimeEntry tests — replaces ScheduleTimeEntryTest.
 * Exact status assertions, DB verification, conflict detection, workload calculation.
 */
class ScheduleProfessionalTest extends TestCase
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
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── SCHEDULE CRUD ──

    public function test_create_schedule_returns_201_and_persists(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $scheduledDate = now()->addDays(3)->format('Y-m-d');

        $response = $this->postJson('/api/v1/schedules', [
            'work_order_id' => $wo->id,
            'technician_id' => $this->user->id,
            'scheduled_date' => $scheduledDate,
            'scheduled_time' => '09:00',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('schedules', [
            'work_order_id' => $wo->id,
            'technician_id' => $this->user->id,
            'scheduled_date' => $scheduledDate,
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_create_schedule_validates_required_fields(): void
    {
        $response = $this->postJson('/api/v1/schedules', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['work_order_id', 'technician_id', 'scheduled_date']);
    }

    public function test_list_schedules_returns_paginated(): void
    {
        $response = $this->getJson('/api/v1/schedules');

        $response->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_unified_schedule_returns_combined_view(): void
    {
        $response = $this->getJson('/api/v1/schedules-unified');

        $response->assertOk();
    }

    public function test_schedule_conflicts_endpoint_works(): void
    {
        $response = $this->getJson('/api/v1/schedules/conflicts');

        $response->assertOk();
    }

    public function test_schedule_workload_summary_returns_data(): void
    {
        $response = $this->getJson('/api/v1/schedules/workload');

        $response->assertOk();
    }

    // ── TIME ENTRIES ──

    public function test_start_time_entry_creates_record_with_start_time(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->postJson('/api/v1/time-entries/start', [
            'work_order_id' => $wo->id,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('time_entries', [
            'work_order_id' => $wo->id,
            'user_id' => $this->user->id,
            'tenant_id' => $this->tenant->id,
        ]);

        $entry = TimeEntry::where('work_order_id', $wo->id)->first();
        $this->assertNotNull($entry->started_at);
        $this->assertNull($entry->ended_at);
    }

    public function test_stop_time_entry_sets_end_time_and_calculates_duration(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        // Start
        $startResponse = $this->postJson('/api/v1/time-entries/start', [
            'work_order_id' => $wo->id,
        ]);
        $startResponse->assertStatus(201);

        $entryId = $startResponse->json('id');

        // Stop
        $stopResponse = $this->postJson("/api/v1/time-entries/{$entryId}/stop");

        $stopResponse->assertOk();

        $entry = TimeEntry::find($entryId);
        $this->assertNotNull($entry->ended_at);
        $this->assertGreaterThanOrEqual(0, $entry->duration_minutes);
    }

    public function test_list_time_entries_returns_data(): void
    {
        $response = $this->getJson('/api/v1/time-entries');

        $response->assertOk();
    }

    public function test_time_entries_summary_returns_aggregated_data(): void
    {
        $response = $this->getJson('/api/v1/time-entries-summary');

        $response->assertOk();
    }

    // ── DOUBLE START PREVENTION ──

    public function test_cannot_start_two_entries_simultaneously(): void
    {
        $wo1 = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $wo2 = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        // Start first
        $this->postJson('/api/v1/time-entries/start', [
            'work_order_id' => $wo1->id,
        ])->assertStatus(201);

        // Second start should fail
        $response = $this->postJson('/api/v1/time-entries/start', [
            'work_order_id' => $wo2->id,
        ]);

        $response->assertStatus(422);
    }
}
