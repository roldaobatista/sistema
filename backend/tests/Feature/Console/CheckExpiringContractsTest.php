<?php

namespace Tests\Feature\Console;

use App\Models\Customer;
use App\Models\Notification;
use App\Models\RecurringContract;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CheckExpiringContractsTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $this->admin = User::factory()->create(['tenant_id' => $this->tenant->id]);
        $this->admin->assignRole($adminRole);
    }

    private function makeContract(array $overrides = []): RecurringContract
    {
        return RecurringContract::create(array_merge([
            'tenant_id' => $this->tenant->id,
            'customer_id' => Customer::factory()->create(['tenant_id' => $this->tenant->id])->id,
            'created_by' => $this->admin->id,
            'name' => 'Contrato Teste',
            'frequency' => 'monthly',
            'billing_type' => 'fixed',
            'start_date' => now()->subYear(),
            'next_run_date' => now()->addMonth(),
            'is_active' => true,
        ], $overrides));
    }

    public function test_alerts_contracts_expiring_within_threshold(): void
    {
        // Contract expiring in 3 days (within default 7-day threshold)
        $expiringContract = $this->makeContract([
            'name' => 'Contrato Expirando',
            'end_date' => now()->addDays(3),
        ]);

        // Contract expiring in 30 days (outside threshold)
        $this->makeContract([
            'name' => 'Contrato Seguro',
            'end_date' => now()->addDays(30),
        ]);

        // Inactive contract (should be ignored)
        $this->makeContract([
            'name' => 'Contrato Inativo',
            'is_active' => false,
            'end_date' => now()->addDays(2),
        ]);

        $this->artisan('contracts:check-expiring')
            ->assertExitCode(0);

        // Should create notification for expiring contract
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->admin->id,
            'type' => 'contract_expiring',
            'notifiable_type' => RecurringContract::class,
            'notifiable_id' => $expiringContract->id,
        ]);
    }

    public function test_deduplicates_alerts_within_3_days(): void
    {
        $contract = $this->makeContract([
            'name' => 'Contrato Dedup',
            'end_date' => now()->addDays(5),
        ]);

        // Run twice
        $this->artisan('contracts:check-expiring')->assertExitCode(0);
        $this->artisan('contracts:check-expiring')->assertExitCode(0);

        // Should only have 1 notification (deduplicated)
        $count = Notification::withoutGlobalScopes()
            ->where('notifiable_type', RecurringContract::class)
            ->where('notifiable_id', $contract->id)
            ->where('user_id', $this->admin->id)
            ->count();

        $this->assertEquals(1, $count);
    }
}
