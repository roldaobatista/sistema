<?php

namespace Tests\Feature;

use App\Events\CustomerCreated;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerTest extends TestCase
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

    // ── CRUD ──

    public function test_create_customer_pf(): void
    {
        Event::fake([CustomerCreated::class]);

        $response = $this->postJson('/api/v1/customers', [
            'type' => 'PF',
            'name' => 'José Silva',
            'document' => '529.982.247-25',
            'email' => 'jose@test.com',
            'phone' => '(11)99999-0000',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'José Silva');

        $this->assertDatabaseHas('customers', [
            'tenant_id' => $this->tenant->id,
            'name' => 'José Silva',
            'type' => 'PF',
        ]);
    }

    public function test_create_customer_pj(): void
    {
        Event::fake([CustomerCreated::class]);

        $response = $this->postJson('/api/v1/customers', [
            'type' => 'PJ',
            'name' => 'Indústria ABC',
            'document' => '11.222.333/0001-81',
            'email' => 'contato@abc.com',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('type', 'PJ');
    }

    public function test_create_customer_with_contacts(): void
    {
        Event::fake([CustomerCreated::class]);

        $response = $this->postJson('/api/v1/customers', [
            'type' => 'PJ',
            'name' => 'Empresa Contatos',
            'contacts' => [
                [
                    'name' => 'Maria RH',
                    'role' => 'RH',
                    'phone' => '(11)88888-0000',
                    'email' => 'maria@empresa.com',
                    'is_primary' => true,
                ],
                [
                    'name' => 'Pedro Compras',
                    'role' => 'Compras',
                    'phone' => '(11)77777-0000',
                ],
            ],
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('customer_contacts', [
            'name' => 'Maria RH',
            'is_primary' => true,
        ]);
    }

    public function test_list_customers(): void
    {
        Customer::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson('/api/v1/customers');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_show_customer(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson("/api/v1/customers/{$customer->id}");

        $response->assertOk()
            ->assertJsonPath('id', $customer->id);
    }

    public function test_update_customer(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->putJson("/api/v1/customers/{$customer->id}", [
            'name' => 'Nome Atualizado',
            'email' => 'novo@email.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'Nome Atualizado');
    }

    public function test_delete_customer(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->deleteJson("/api/v1/customers/{$customer->id}");

        $response->assertStatus(204);
    }

    // ── Search ──

    public function test_search_customers_by_name(): void
    {
        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Balanças Solution LTDA',
        ]);

        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Outro Cliente',
        ]);

        $response = $this->getJson('/api/v1/customers?search=Balanças');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ── Filter ──

    public function test_filter_customers_by_type(): void
    {
        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'type' => 'PF',
        ]);

        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'type' => 'PJ',
        ]);

        $response = $this->getJson('/api/v1/customers?type=PJ');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_filter_customers_by_active(): void
    {
        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/v1/customers?is_active=true');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ── Tenant Isolation ──

    public function test_customers_isolated_by_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();

        Customer::factory()->create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Cliente Externo',
        ]);

        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Cliente Interno',
        ]);

        $response = $this->getJson('/api/v1/customers');

        $response->assertOk()
            ->assertDontSee('Cliente Externo');
    }

    // ── Duplicate Document ──

    public function test_cannot_create_duplicate_document(): void
    {
        Event::fake([CustomerCreated::class]);

        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'document' => '12.345.678/0001-90',
        ]);

        $response = $this->postJson('/api/v1/customers', [
            'type' => 'PJ',
            'name' => 'Duplicata',
            'document' => '12.345.678/0001-90',
        ]);

        $response->assertStatus(422);
    }

    public function test_legacy_duplicates_endpoint_is_available(): void
    {
        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Duplicado LTDA',
        ]);

        Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Duplicado LTDA',
        ]);

        $response = $this->getJson('/api/v1/customers/duplicates?type=name');

        $response->assertOk()
            ->assertJsonFragment(['key' => 'Duplicado LTDA']);
    }

    public function test_merge_uses_current_tenant_context_when_user_switches_company(): void
    {
        $switchedTenant = Tenant::factory()->create();

        $this->user->update([
            'current_tenant_id' => $switchedTenant->id,
        ]);

        app()->instance('current_tenant_id', $switchedTenant->id);

        $primary = Customer::factory()->create([
            'tenant_id' => $switchedTenant->id,
            'name' => 'Cliente Principal',
        ]);

        $duplicate = Customer::factory()->create([
            'tenant_id' => $switchedTenant->id,
            'name' => 'Cliente Duplicado',
        ]);

        $response = $this->postJson('/api/v1/customers/merge', [
            'primary_id' => $primary->id,
            'duplicate_ids' => [$duplicate->id],
        ]);

        $response->assertOk();

        $this->assertSoftDeleted('customers', [
            'id' => $duplicate->id,
        ]);
    }
}
