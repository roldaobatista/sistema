<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\AccountPayable;
use App\Models\Product;
use App\Models\Quote;
use App\Models\QuoteItem;
use App\Models\Service;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Tenant;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class DependencyTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        // Create a tenant explicitly
        $this->tenant = Tenant::factory()->create();
        // Create a user belonging to that tenant
        $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
        
        // Setup permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        
        $permissions = [
            'platform.branch.delete',
            'cadastros.customer.delete',
            'cadastros.product.delete',
            'cadastros.service.delete',
            'cadastros.supplier.delete',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }
        
        $this->user->givePermissionTo($permissions);

        $this->actingAs($this->user);
    }

    public function test_cannot_delete_branch_with_users()
    {
        $branch = Branch::factory()->create(['tenant_id' => $this->tenant->id]);
        User::factory()->create([
            'branch_id' => $branch->id,
            'tenant_id' => $this->tenant->id
        ]);

        $response = $this->deleteJson("/api/v1/branches/{$branch->id}");

        $response->assertStatus(409)
            ->assertJsonStructure(['message', 'dependencies' => ['users']]);
    }

    public function test_cannot_delete_customer_with_work_orders()
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        WorkOrder::factory()->create([
            'customer_id' => $customer->id,
            'tenant_id' => $this->tenant->id
        ]);

        $response = $this->deleteJson("/api/v1/customers/{$customer->id}");

        $response->assertStatus(409)
            ->assertJsonStructure(['message', 'dependencies' => ['active_work_orders']]);
    }

    public function test_cannot_delete_product_with_quote_items()
    {
        $product = Product::factory()->create(['tenant_id' => $this->tenant->id]);
        $quote = Quote::factory()->create(['tenant_id' => $this->tenant->id]);
        $quoteEquipment = \App\Models\QuoteEquipment::factory()->create(['quote_id' => $quote->id]);
        
        \App\Models\QuoteItem::factory()->create([
            'quote_equipment_id' => $quoteEquipment->id,
            'product_id' => $product->id,
            'tenant_id' => $this->tenant->id,
            'type' => 'product'
        ]);

        $response = $this->deleteJson("/api/v1/products/{$product->id}");

        $response->assertStatus(409)
            ->assertJsonStructure(['message', 'dependencies' => ['quotes']]);
    }

    public function test_cannot_delete_service_with_quote_items()
    {
        $service = Service::factory()->create(['tenant_id' => $this->tenant->id]);
        $quote = Quote::factory()->create(['tenant_id' => $this->tenant->id]);
        $quoteEquipment = \App\Models\QuoteEquipment::factory()->create(['quote_id' => $quote->id]);

        \App\Models\QuoteItem::factory()->create([
            'quote_equipment_id' => $quoteEquipment->id,
            'service_id' => $service->id,
            'tenant_id' => $this->tenant->id,
            'type' => 'service'
        ]);

        $response = $this->deleteJson("/api/v1/services/{$service->id}");

        $response->assertStatus(409)
            ->assertJsonStructure(['message', 'dependencies' => ['quotes']]);
    }

    public function test_cannot_delete_supplier_with_accounts_payable()
    {
        $supplier = Supplier::factory()->create(['tenant_id' => $this->tenant->id]);
        AccountPayable::factory()->create([
            'supplier_id' => $supplier->id,
            'tenant_id' => $this->tenant->id
        ]);

        $response = $this->deleteJson("/api/v1/suppliers/{$supplier->id}");

        $response->assertStatus(409)
            ->assertJsonStructure(['message', 'dependencies' => ['accounts_payable']]);
    }

    public function test_can_delete_branch_forcefully_if_implemented_or_cleared()
    {
        $branchEmpty = Branch::factory()->create(['tenant_id' => $this->tenant->id]);
        $response = $this->deleteJson("/api/v1/branches/{$branchEmpty->id}");
        $response->assertStatus(204);
    }
}
