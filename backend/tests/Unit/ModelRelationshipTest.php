<?php

namespace Tests\Unit;

use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Product;
use App\Models\Quote;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Model Relationship Tests — validates that Eloquent relationships
 * are correctly defined and return expected types.
 */
class ModelRelationshipTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        $this->actingAs($this->user);
    }

    // ── CUSTOMER RELATIONSHIPS ──

    public function test_customer_has_many_work_orders(): void
    {
        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertGreaterThanOrEqual(1, $this->customer->workOrders()->count());
    }

    public function test_customer_has_many_equipments(): void
    {
        Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertGreaterThanOrEqual(1, $this->customer->equipments()->count());
    }

    public function test_customer_has_many_quotes(): void
    {
        Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertGreaterThanOrEqual(1, $this->customer->quotes()->count());
    }

    public function test_customer_belongs_to_tenant(): void
    {
        $this->assertNotNull($this->customer->tenant);
        $this->assertEquals($this->tenant->id, $this->customer->tenant->id);
    }

    // ── WORK ORDER RELATIONSHIPS ──

    public function test_work_order_belongs_to_customer(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertNotNull($wo->customer);
        $this->assertInstanceOf(Customer::class, $wo->customer);
    }

    public function test_work_order_belongs_to_tenant(): void
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertEquals($this->tenant->id, $wo->tenant_id);
    }

    // ── EQUIPMENT RELATIONSHIPS ──

    public function test_equipment_belongs_to_customer(): void
    {
        $eq = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertNotNull($eq->customer);
        $this->assertInstanceOf(Customer::class, $eq->customer);
    }

    // ── QUOTE RELATIONSHIPS ──

    public function test_quote_belongs_to_customer(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->assertNotNull($quote->customer);
    }

    // ── USER RELATIONSHIPS ──

    public function test_user_belongs_to_many_tenants(): void
    {
        $tenants = $this->user->tenants;
        $this->assertGreaterThanOrEqual(1, $tenants->count());
    }

    public function test_user_has_current_tenant(): void
    {
        $this->assertNotNull($this->user->current_tenant_id);
    }

    // ── TENANT RELATIONSHIPS ──

    public function test_tenant_has_many_customers(): void
    {
        $count = $this->tenant->customers()->count();
        $this->assertGreaterThanOrEqual(1, $count);
    }

    // ── ACCOUNT RECEIVABLE ──

    public function test_receivable_belongs_to_customer(): void
    {
        $ar = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'description' => 'Test',
            'amount' => 100,
            'amount_paid' => 0,
            'status' => 'pending',
            'due_date' => now()->addDays(30),
        ]);

        $this->assertNotNull($ar->customer);
        $this->assertEquals($this->customer->id, $ar->customer->id);
    }

    // ── SOFT DELETE BEHAVIOR ──

    public function test_soft_deleted_customer_is_excluded_from_queries(): void
    {
        $softTarget = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'SoftDelete Target',
        ]);

        $softTarget->delete();

        $found = Customer::where('name', 'SoftDelete Target')->first();
        $this->assertNull($found);

        $withTrashed = Customer::withTrashed()->where('name', 'SoftDelete Target')->first();
        $this->assertNotNull($withTrashed);
    }
}
