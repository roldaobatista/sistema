<?php

namespace Tests\Feature;

use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupplierTest extends TestCase
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

    public function test_create_supplier_pj(): void
    {
        $response = $this->postJson('/api/v1/suppliers', [
            'type' => 'PJ',
            'name' => 'Fornecedor Teste',
            'document' => '12.345.678/0001-99',
            'email' => 'fornecedor@test.com',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Fornecedor Teste');
    }

    public function test_list_suppliers(): void
    {
        Supplier::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson('/api/v1/suppliers');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_show_supplier(): void
    {
        $supplier = Supplier::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson("/api/v1/suppliers/{$supplier->id}");

        $response->assertOk()
            ->assertJsonPath('id', $supplier->id);
    }

    public function test_update_supplier(): void
    {
        $supplier = Supplier::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->putJson("/api/v1/suppliers/{$supplier->id}", [
            'name' => 'Nome Atualizado',
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'Nome Atualizado');
    }

    public function test_delete_supplier(): void
    {
        $supplier = Supplier::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->deleteJson("/api/v1/suppliers/{$supplier->id}");

        $response->assertStatus(204);
    }
}
