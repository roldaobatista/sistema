<?php

namespace Tests\Feature\Console;

use App\Models\Customer;
use App\Models\Notification;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CheckUnbilledWorkOrdersTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    public function test_alerts_completed_work_orders_without_billing(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin = User::factory()->create(['tenant_id' => $this->tenant->id]);
        $admin->assignRole($adminRole);

        // Completed WO 5 days ago without billing (should alert)
        $unbilledWo = WorkOrder::factory()->completed()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'completed_at' => now()->subDays(5),
        ]);

        // Completed WO 1 day ago (within grace period, should NOT alert)
        $recentWo = WorkOrder::factory()->completed()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'completed_at' => now()->subDay(),
        ]);

        // Open WO (should NOT alert)
        $openWo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
        ]);

        $this->artisan('work-orders:check-unbilled')
            ->assertExitCode(0);

        // Should alert for unbilled WO
        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'type' => 'unbilled_work_order',
            'notifiable_type' => WorkOrder::class,
            'notifiable_id' => $unbilledWo->id,
        ]);

        // Should NOT alert for recent or open WOs
        $this->assertDatabaseMissing('notifications', [
            'notifiable_type' => WorkOrder::class,
            'notifiable_id' => $recentWo->id,
            'type' => 'unbilled_work_order',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'notifiable_type' => WorkOrder::class,
            'notifiable_id' => $openWo->id,
            'type' => 'unbilled_work_order',
        ]);
    }

    public function test_excludes_work_orders_with_accounts_receivable(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin = User::factory()->create(['tenant_id' => $this->tenant->id]);
        $admin->assignRole($adminRole);

        $billedWo = WorkOrder::factory()->completed()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'completed_at' => now()->subDays(10),
        ]);

        // Create an accounts receivable linked to this WO
        \DB::table('accounts_receivable')->insert([
            'tenant_id' => $this->tenant->id,
            'work_order_id' => $billedWo->id,
            'customer_id' => $customer->id,
            'description' => 'Faturamento OS',
            'amount' => 1000,
            'amount_paid' => 0,
            'due_date' => now()->addDays(30),
            'status' => 'pending',
            'created_by' => $admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('work-orders:check-unbilled')
            ->assertExitCode(0);

        // Should NOT alert because WO has billing
        $this->assertDatabaseMissing('notifications', [
            'notifiable_type' => WorkOrder::class,
            'notifiable_id' => $billedWo->id,
            'type' => 'unbilled_work_order',
        ]);
    }

    public function test_deduplicates_alerts_within_1_day(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin = User::factory()->create(['tenant_id' => $this->tenant->id]);
        $admin->assignRole($adminRole);

        $unbilledWo = WorkOrder::factory()->completed()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'completed_at' => now()->subDays(5),
        ]);

        // Run twice
        $this->artisan('work-orders:check-unbilled')->assertExitCode(0);
        $this->artisan('work-orders:check-unbilled')->assertExitCode(0);

        // Should only have 1 notification (deduplicated)
        $count = Notification::where('notifiable_type', WorkOrder::class)
            ->where('notifiable_id', $unbilledWo->id)
            ->where('user_id', $admin->id)
            ->where('type', 'unbilled_work_order')
            ->count();

        $this->assertEquals(1, $count);
    }
}
