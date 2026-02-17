<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Warehouse $warehouse;

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

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);

        $this->warehouse = Warehouse::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Estoque Central',
            'code' => 'CENTRAL-TEST',
            'type' => 'fixed',
            'is_active' => true,
        ]);
    }

    // ── Movimentações ──

    public function test_create_stock_entry(): void
    {
        $product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'stock_qty' => 10,
        ]);

        $response = $this->postJson('/api/v1/stock/movements', [
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouse->id,
            'type' => 'entry',
            'quantity' => 5,
            'unit_cost' => 25.00,
            'notes' => 'Compra fornecedor',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'type' => 'entry',
        ]);
    }

    public function test_create_stock_adjustment(): void
    {
        $product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'stock_qty' => 50,
        ]);

        $response = $this->postJson('/api/v1/stock/movements', [
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouse->id,
            'type' => 'adjustment',
            'quantity' => 5,
            'notes' => 'Ajuste de inventário',
        ]);

        $response->assertStatus(201);
    }

    public function test_list_movements(): void
    {
        $product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        StockMovement::create([
            'tenant_id' => $this->tenant->id,
            'product_id' => $product->id,
            'type' => 'entry',
            'quantity' => 10,
            'unit_cost' => 15.00,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/stock/movements');

        $response->assertOk();
    }

    public function test_filter_movements_by_product(): void
    {
        $product1 = Product::factory()->create(['tenant_id' => $this->tenant->id]);
        $product2 = Product::factory()->create(['tenant_id' => $this->tenant->id]);

        StockMovement::create([
            'tenant_id' => $this->tenant->id,
            'product_id' => $product1->id,
            'type' => 'entry',
            'quantity' => 5,
            'unit_cost' => 10,
            'created_by' => $this->user->id,
        ]);

        StockMovement::create([
            'tenant_id' => $this->tenant->id,
            'product_id' => $product2->id,
            'type' => 'entry',
            'quantity' => 3,
            'unit_cost' => 10,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson("/api/v1/stock/movements?product_id={$product1->id}");

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ── Summary ──

    public function test_stock_summary(): void
    {
        Product::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson('/api/v1/stock/summary');

        $response->assertOk()
            ->assertJsonStructure(['products', 'stats'])
            ->assertJsonPath('stats.total_products', 3);
    }

    // ── Low Stock Alerts ──

    public function test_low_stock_alerts(): void
    {
        Product::factory()->lowStock()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'stock_qty' => 100,
            'stock_min' => 5,
        ]);

        $response = $this->getJson('/api/v1/stock/low-stock-alerts');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ── Validation ──

    public function test_stock_entry_requires_product(): void
    {
        $response = $this->postJson('/api/v1/stock/movements', [
            'type' => 'entry',
            'quantity' => 5,
        ]);

        $response->assertStatus(422);
    }

    public function test_stock_entry_requires_positive_quantity(): void
    {
        $product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->postJson('/api/v1/stock/movements', [
            'product_id' => $product->id,
            'type' => 'entry',
            'quantity' => 0,
        ]);

        $response->assertStatus(422);
    }
}
