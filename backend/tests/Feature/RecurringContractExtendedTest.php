<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\RecurringContract;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Recurring Contract Tests — validates CRUD, generation of Work Orders
 * from contracts, validation rules, and active/inactive filtering.
 */
class RecurringContractExtendedTest extends TestCase
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
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_list_recurring_contracts(): void
    {
        $response = $this->getJson('/api/v1/recurring-contracts');
        $response->assertOk();
    }

    public function test_create_recurring_contract_with_valid_data(): void
    {
        $response = $this->postJson('/api/v1/recurring-contracts', [
            'customer_id' => $this->customer->id,
            'name' => 'Calibração mensal - Balança Industrial',
            'frequency' => 'monthly',
            'start_date' => now()->addDays(7)->format('Y-m-d'),
            'priority' => 'normal',
            'items' => [
                [
                    'type' => 'service',
                    'description' => 'Calibração de balança',
                    'quantity' => 1,
                    'unit_price' => 350.00,
                ],
            ],
        ]);

        $response->assertCreated();

        $data = $response->json();
        $this->assertEquals('Calibração mensal - Balança Industrial', $data['name']);
    }

    public function test_create_contract_requires_customer_and_name(): void
    {
        $response = $this->postJson('/api/v1/recurring-contracts', [
            'frequency' => 'monthly',
        ]);

        $response->assertStatus(422);
    }

    public function test_create_contract_validates_frequency(): void
    {
        $response = $this->postJson('/api/v1/recurring-contracts', [
            'customer_id' => $this->customer->id,
            'name' => 'Contrato teste',
            'frequency' => 'every_day', // invalid
            'start_date' => now()->format('Y-m-d'),
        ]);

        $response->assertStatus(422);
    }

    public function test_show_recurring_contract(): void
    {
        $contract = RecurringContract::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson("/api/v1/recurring-contracts/{$contract->id}");
        $response->assertOk();
    }

    public function test_update_recurring_contract(): void
    {
        $contract = RecurringContract::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->putJson("/api/v1/recurring-contracts/{$contract->id}", [
            'name' => 'Contrato atualizado',
            'is_active' => false,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('recurring_contracts', [
            'id' => $contract->id,
            'name' => 'Contrato atualizado',
        ]);
    }

    public function test_generate_work_order_from_active_contract(): void
    {
        $contract = RecurringContract::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'is_active' => true,
        ]);

        $response = $this->postJson("/api/v1/recurring-contracts/{$contract->id}/generate");

        $response->assertOk();

        $this->assertArrayHasKey('work_order', $response->json());
    }

    public function test_generate_rejects_inactive_contract(): void
    {
        $contract = RecurringContract::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'is_active' => false,
        ]);

        $response = $this->postJson("/api/v1/recurring-contracts/{$contract->id}/generate");
        $response->assertStatus(422);
    }
}
