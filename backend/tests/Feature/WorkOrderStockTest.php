<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderStockTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
        
        // Ensure tenant context is set for BelongsToTenant scope
        app()->instance('current_tenant_id', $this->tenant->id);
        
        // Create default warehouse for stock operations
        \App\Models\Warehouse::create([
            'tenant_id' => $this->tenant->id,
            'type' => 'fixed',
            'name' => 'Central Warehouse',
            'code' => 'CENTRAL',
            'is_active' => true,
        ]);

        $this->actingAs($this->user);
    }

    public function test_changing_product_references_correctly_updates_stock()
    {
        // 1. Setup Products
        $productA = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'track_stock' => true,
            'stock_qty' => 100,
            'sell_price' => 50,
        ]);
        
        \App\Models\WarehouseStock::create([
            'tenant_id' => $this->tenant->id,
            'warehouse_id' => \App\Models\Warehouse::where('code', 'CENTRAL')->first()->id,
            'product_id' => $productA->id,
            'quantity' => 100,
        ]);

        $productB = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'track_stock' => true,
            'stock_qty' => 100,
            'sell_price' => 80,
        ]);

        \App\Models\WarehouseStock::create([
            'tenant_id' => $this->tenant->id,
            'warehouse_id' => \App\Models\Warehouse::where('code', 'CENTRAL')->first()->id,
            'product_id' => $productB->id,
            'quantity' => 100,
        ]);

        // 2. Create OS with Product A (Qty 10)
        $workOrder = WorkOrder::factory()->create(['tenant_id' => $this->tenant->id]);
        
        $item = $workOrder->items()->create([
            'tenant_id' => $this->tenant->id,
            'type' => 'product',
            'reference_id' => $productA->id,
            'description' => $productA->name,
            'quantity' => 10,
            'unit_price' => $productA->sell_price,
        ]);

        // Assert Product A stock reduced
        $this->assertEquals(90, $productA->fresh()->stock_qty);
        $this->assertEquals(100, $productB->fresh()->stock_qty);

        // 3. Change Item to Product B (Qty 5)
        $item->update([
            'reference_id' => $productB->id,
            'quantity' => 5,
        ]);

        // 4. Assert Stock Correction
        // Product A should be fully refunded (100)
        $this->assertEquals(100, $productA->fresh()->stock_qty, 'Product A stock should be restored');
        
        // Product B should be reduced (95)
        $this->assertEquals(95, $productB->fresh()->stock_qty, 'Product B stock should be reduced');
    }

    public function test_deleting_item_restores_stock()
    {
        $product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'track_stock' => true,
            'stock_qty' => 50,
        ]);
        
        \App\Models\WarehouseStock::create([
            'tenant_id' => $this->tenant->id,
            'warehouse_id' => \App\Models\Warehouse::where('code', 'CENTRAL')->first()->id,
            'product_id' => $product->id,
            'quantity' => 50,
        ]);

        $workOrder = WorkOrder::factory()->create(['tenant_id' => $this->tenant->id]);
        
        $item = $workOrder->items()->create([
            'tenant_id' => $this->tenant->id,
            'type' => 'product',
            'reference_id' => $product->id,
            'description' => $product->name,
            'quantity' => 5, // Reserve 5
            'unit_price' => 10,
        ]);

        $this->assertEquals(45, $product->fresh()->stock_qty);

        $item->delete();

        $this->assertEquals(50, $product->fresh()->stock_qty);
    }
}
