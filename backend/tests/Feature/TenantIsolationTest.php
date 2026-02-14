<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Quote;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * PROFESSIONAL Security Tests — Tenant Isolation
 *
 * Tests that data is completely isolated between tenants.
 * NO middleware is disabled — tests run with FULL security stack.
 */
class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenantA;
    private Tenant $tenantB;
    private User $userA;
    private User $userB;
    private Customer $customerA;
    private Customer $customerB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenantA = Tenant::factory()->create(['name' => 'Empresa A']);
        $this->tenantB = Tenant::factory()->create(['name' => 'Empresa B']);

        $this->userA = User::factory()->create([
            'tenant_id' => $this->tenantA->id,
            'current_tenant_id' => $this->tenantA->id,
        ]);
        $this->userB = User::factory()->create([
            'tenant_id' => $this->tenantB->id,
            'current_tenant_id' => $this->tenantB->id,
        ]);

        // Give both users admin role in their respective tenants
        foreach ([[$this->userA, $this->tenantA], [$this->userB, $this->tenantB]] as [$user, $tenant]) {
            setPermissionsTeamId($tenant->id);
            $role = \Spatie\Permission\Models\Role::firstOrCreate(
                ['name' => 'admin', 'guard_name' => 'api', 'team_id' => $tenant->id]
            );
            $user->assignRole($role);
        }

        $this->customerA = Customer::factory()->create(['tenant_id' => $this->tenantA->id, 'name' => 'Cliente A']);
        $this->customerB = Customer::factory()->create(['tenant_id' => $this->tenantB->id, 'name' => 'Cliente B']);
    }

    // ═══════════════════════════════════════════════════════════
    // 1. CUSTOMER — Listagem filtra por tenant
    // ═══════════════════════════════════════════════════════════

    public function test_user_a_only_sees_tenant_a_customers(): void
    {
        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->getJson('/api/v1/customers');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('name')->toArray();
        $this->assertContains('Cliente A', $names);
        $this->assertNotContains('Cliente B', $names);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. CUSTOMER — Acesso direto a recurso de outro tenant
    // ═══════════════════════════════════════════════════════════

    public function test_user_a_cannot_access_tenant_b_customer(): void
    {
        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->getJson("/api/v1/customers/{$this->customerB->id}");

        $response->assertStatus(404);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. WORK ORDER — Isolamento
    // ═══════════════════════════════════════════════════════════

    public function test_user_a_cannot_see_tenant_b_work_orders(): void
    {
        $woB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenantB->id,
            'customer_id' => $this->customerB->id,
        ]);

        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->getJson('/api/v1/work-orders');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertNotContains($woB->id, $ids);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. WORK ORDER — Acesso direto cross-tenant
    // ═══════════════════════════════════════════════════════════

    public function test_user_a_cannot_view_tenant_b_work_order(): void
    {
        $woB = WorkOrder::factory()->create([
            'tenant_id' => $this->tenantB->id,
            'customer_id' => $this->customerB->id,
        ]);

        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->getJson("/api/v1/work-orders/{$woB->id}");

        $response->assertStatus(404);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. QUOTE — Isolamento
    // ═══════════════════════════════════════════════════════════

    public function test_quotes_are_tenant_isolated(): void
    {
        Quote::factory()->create(['tenant_id' => $this->tenantB->id, 'customer_id' => $this->customerB->id]);

        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->getJson('/api/v1/quotes');

        $response->assertOk();
        $data = $response->json('data', []);
        foreach ($data as $quote) {
            $this->assertNotEquals($this->tenantB->id, $quote['tenant_id'] ?? null);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 6. EQUIPMENT — Isolamento
    // ═══════════════════════════════════════════════════════════

    public function test_equipment_are_tenant_isolated(): void
    {
        Equipment::factory()->create(['tenant_id' => $this->tenantB->id, 'customer_id' => $this->customerB->id]);

        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->getJson('/api/v1/equipment');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('tenant_id')->unique()->toArray();
        $this->assertNotContains($this->tenantB->id, $ids);
    }

    // ═══════════════════════════════════════════════════════════
    // 7. CRIAÇÃO VINCULA AO TENANT CORRETO
    // ═══════════════════════════════════════════════════════════

    public function test_created_resource_belongs_to_authenticated_tenant(): void
    {
        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->postJson('/api/v1/customers', [
            'name' => 'Novo Cliente',
            'type' => 'PJ',
            'document' => '12345678000199',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('customers', [
            'name' => 'Novo Cliente',
            'tenant_id' => $this->tenantA->id,
        ]);
        $this->assertDatabaseMissing('customers', [
            'name' => 'Novo Cliente',
            'tenant_id' => $this->tenantB->id,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 8. UPDATE CROSS-TENANT FALHA
    // ═══════════════════════════════════════════════════════════

    public function test_cannot_update_resource_from_other_tenant(): void
    {
        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->putJson("/api/v1/customers/{$this->customerB->id}", [
            'name' => 'Hacked Name',
        ]);

        $response->assertStatus(404);
        $this->assertDatabaseMissing('customers', ['name' => 'Hacked Name']);
    }

    // ═══════════════════════════════════════════════════════════
    // 9. DELETE CROSS-TENANT FALHA
    // ═══════════════════════════════════════════════════════════

    public function test_cannot_delete_resource_from_other_tenant(): void
    {
        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->deleteJson("/api/v1/customers/{$this->customerB->id}");

        $response->assertStatus(404);
        $this->assertDatabaseHas('customers', ['id' => $this->customerB->id]);
    }

    // ═══════════════════════════════════════════════════════════
    // 10. SUPPLIER — Isolamento
    // ═══════════════════════════════════════════════════════════

    public function test_suppliers_are_tenant_isolated(): void
    {
        Supplier::factory()->create(['tenant_id' => $this->tenantB->id]);

        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->getJson('/api/v1/suppliers');

        $response->assertOk();
        $data = $response->json('data', []);
        foreach ($data as $supplier) {
            $this->assertNotEquals($this->tenantB->id, $supplier['tenant_id'] ?? null);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 11. SEARCH NÃO VAZA DADOS
    // ═══════════════════════════════════════════════════════════

    public function test_search_does_not_leak_cross_tenant_data(): void
    {
        Sanctum::actingAs($this->userA);
        app()->instance('current_tenant_id', $this->tenantA->id);

        $response = $this->getJson('/api/v1/customers?search=Cliente B');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('name')->toArray();
        $this->assertNotContains('Cliente B', $names);
    }

    // ═══════════════════════════════════════════════════════════
    // 12. SEM TOKEN = 401
    // ═══════════════════════════════════════════════════════════

    public function test_unauthenticated_request_returns_401(): void
    {
        $response = $this->getJson('/api/v1/customers');

        $response->assertUnauthorized();
    }
}
