<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Supplier CRUD Tests — validates listing, search, creation,
 * update, deletion with dependency check, and validation rules.
 */
class SupplierCrudTest extends TestCase
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
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_list_suppliers(): void
    {
        $response = $this->getJson('/api/v1/suppliers');
        $response->assertOk();
    }

    public function test_create_supplier_pj(): void
    {
        $response = $this->postJson('/api/v1/suppliers', [
            'type' => 'PJ',
            'name' => 'Fornecedor ABC Ltda',
            'document' => '12.345.678/0001-90',
            'trade_name' => 'ABC Supplies',
            'email' => 'contato@abc.com.br',
            'phone' => '(11) 3456-7890',
        ]);

        $response->assertCreated();
        $this->assertEquals('Fornecedor ABC Ltda', $response->json('name'));
    }

    public function test_create_supplier_requires_name_and_type(): void
    {
        $response = $this->postJson('/api/v1/suppliers', [
            'email' => 'test@test.com',
        ]);

        $response->assertStatus(422);
    }

    public function test_create_supplier_validates_type(): void
    {
        $response = $this->postJson('/api/v1/suppliers', [
            'type' => 'CORPORATION', // invalid
            'name' => 'Fornecedor Teste',
        ]);

        $response->assertStatus(422);
    }

    public function test_show_supplier(): void
    {
        $supplier = Supplier::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->getJson("/api/v1/suppliers/{$supplier->id}");
        $response->assertOk();
        $this->assertEquals($supplier->name, $response->json('name'));
    }

    public function test_update_supplier(): void
    {
        $supplier = Supplier::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->putJson("/api/v1/suppliers/{$supplier->id}", [
            'name' => 'Fornecedor Atualizado',
            'is_active' => false,
        ]);

        $response->assertOk();
    }

    public function test_delete_supplier_without_dependencies(): void
    {
        $supplier = Supplier::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->deleteJson("/api/v1/suppliers/{$supplier->id}");
        $response->assertNoContent();
    }

    public function test_delete_supplier_with_payables_returns_409(): void
    {
        $supplier = Supplier::factory()->create(['tenant_id' => $this->tenant->id]);

        AccountPayable::factory()->create([
            'tenant_id' => $this->tenant->id,
            'supplier_id' => $supplier->id,
        ]);

        $response = $this->deleteJson("/api/v1/suppliers/{$supplier->id}");
        $response->assertStatus(409);
        $this->assertStringContainsString('conta(s) a pagar', $response->json('message'));
    }

    public function test_search_suppliers(): void
    {
        Supplier::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Distribuidora XYZ',
        ]);

        $response = $this->getJson('/api/v1/suppliers?search=XYZ');
        $response->assertOk();
    }
}
