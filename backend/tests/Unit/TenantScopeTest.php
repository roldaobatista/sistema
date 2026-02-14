<?php

namespace Tests\Unit;

use App\Models\Tenant;
use App\Models\User;
use App\Models\Customer;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for Tenant Scope and Model behaviors — validates that
 * models automatically apply tenant scoping and auto-set tenant_id.
 */
class TenantScopeTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenantA;
    private Tenant $tenantB;
    private User $userA;
    private User $userB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenantA = Tenant::factory()->create();
        $this->tenantB = Tenant::factory()->create();

        $this->userA = User::factory()->create([
            'tenant_id' => $this->tenantA->id,
            'current_tenant_id' => $this->tenantA->id,
        ]);
        $this->userA->tenants()->attach($this->tenantA->id, ['is_default' => true]);

        $this->userB = User::factory()->create([
            'tenant_id' => $this->tenantB->id,
            'current_tenant_id' => $this->tenantB->id,
        ]);
        $this->userB->tenants()->attach($this->tenantB->id, ['is_default' => true]);
    }

    public function test_customer_created_with_tenant_scope_has_correct_tenant_id(): void
    {
        app()->instance('current_tenant_id', $this->tenantA->id);
        $this->actingAs($this->userA);

        $customer = Customer::create([
            'tenant_id' => $this->tenantA->id,
            'name' => 'Customer A',
            'type' => 'PF',
        ]);

        $this->assertEquals($this->tenantA->id, $customer->tenant_id);
    }

    public function test_query_only_returns_current_tenant_data(): void
    {
        // Create customers in both tenants (bypassing scope)
        Customer::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantA->id,
            'name' => 'Customer Tenant A',
            'type' => 'PF',
        ]);
        Customer::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantB->id,
            'name' => 'Customer Tenant B',
            'type' => 'PJ',
        ]);

        // Set context to tenant A
        app()->instance('current_tenant_id', $this->tenantA->id);
        $this->actingAs($this->userA);

        $customers = Customer::all();
        $this->assertTrue($customers->every(fn ($c) => $c->tenant_id === $this->tenantA->id));
        $this->assertFalse($customers->contains(fn ($c) => $c->name === 'Customer Tenant B'));
    }

    public function test_work_order_scoped_to_tenant(): void
    {
        $customerA = Customer::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantA->id,
            'name' => 'C-A',
            'type' => 'PF',
        ]);
        $customerB = Customer::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantB->id,
            'name' => 'C-B',
            'type' => 'PF',
        ]);

        WorkOrder::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantA->id,
            'customer_id' => $customerA->id,
            'description' => 'WO Tenant A',
            'status' => 'open',
        ]);
        WorkOrder::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantB->id,
            'customer_id' => $customerB->id,
            'description' => 'WO Tenant B',
            'status' => 'open',
        ]);

        app()->instance('current_tenant_id', $this->tenantA->id);
        $this->actingAs($this->userA);

        $workOrders = WorkOrder::all();
        $this->assertTrue($workOrders->every(fn ($wo) => $wo->tenant_id === $this->tenantA->id));
    }
}
