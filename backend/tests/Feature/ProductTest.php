<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;

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
    }

    // ── Product CRUD ──

    public function test_create_product(): void
    {
        $response = $this->postJson('/api/v1/products', [
            'name' => 'Massa Padrão 1kg',
            'code' => 'MP-001',
            'cost_price' => 150.00,
            'sell_price' => 250.00,
            'stock_qty' => 10,
            'stock_min' => 2,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Massa Padrão 1kg');
    }

    public function test_list_products(): void
    {
        Product::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson('/api/v1/products');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_show_product(): void
    {
        $product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson("/api/v1/products/{$product->id}");

        $response->assertOk()
            ->assertJsonPath('id', $product->id);
    }

    public function test_update_product(): void
    {
        $product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->putJson("/api/v1/products/{$product->id}", [
            'name' => 'Produto Atualizado',
            'sell_price' => 300.00,
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'Produto Atualizado');
    }

    public function test_delete_product(): void
    {
        $product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->deleteJson("/api/v1/products/{$product->id}");

        $response->assertStatus(204);
    }

    // ── Search & Filter ──

    public function test_search_product_by_name(): void
    {
        Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Sensor de Temperatura',
        ]);

        Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Parafuso M8',
        ]);

        $response = $this->getJson('/api/v1/products?search=Sensor');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_filter_low_stock(): void
    {
        Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'stock_qty' => 1,
            'stock_min' => 5,
        ]);

        Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'stock_qty' => 100,
            'stock_min' => 5,
        ]);

        $response = $this->getJson('/api/v1/products?low_stock=true');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ── Categories ──

    public function test_create_category(): void
    {
        $response = $this->postJson('/api/v1/product-categories', [
            'name' => 'Peças de Reposição',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Peças de Reposição');
    }

    public function test_list_categories(): void
    {
        ProductCategory::create(['name' => 'Categoria A', 'tenant_id' => $this->tenant->id]);
        ProductCategory::create(['name' => 'Categoria B', 'tenant_id' => $this->tenant->id]);

        $response = $this->getJson('/api/v1/product-categories');

        $response->assertOk();
    }

    public function test_delete_category(): void
    {
        $cat = ProductCategory::create(['name' => 'Temp', 'tenant_id' => $this->tenant->id]);

        $response = $this->deleteJson("/api/v1/product-categories/{$cat->id}");

        $response->assertStatus(204);
    }

    // ── Tenant Isolation ──

    public function test_products_isolated_by_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();

        Product::factory()->create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Produto Externo',
        ]);

        Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Produto Interno',
        ]);

        $response = $this->getJson('/api/v1/products');

        $response->assertOk()
            ->assertDontSee('Produto Externo');
    }
}
