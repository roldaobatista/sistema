<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\AccountPayableCategory;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountPayableTest extends TestCase
{
    use RefreshDatabase;

    protected $tenant;
    protected $user;
    protected $otherTenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);
        
        // Setup Tenant and User
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        
        $this->otherTenant = Tenant::factory()->create();

        app()->instance('current_tenant_id', $this->tenant->id);

        $perms = [
            'finance.payable.create', 'finance.payable.view', 'finance.payable.update', 'finance.payable.delete', 'finance.payable.pay',
            'finance.category.create', 'finance.category.view', 'finance.category.update', 'finance.category.delete'
        ];
        foreach ($perms as $p) {
            \Spatie\Permission\Models\Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }
        $this->user->givePermissionTo($perms);

        Sanctum::actingAs($this->user, ['*']);
    }

    // --- PAYABLE TESTS ---

    public function test_can_create_account_payable()
    {

        $data = [
            'description' => 'Conta de Luz',
            'amount' => 150.50,
            'due_date' => now()->addDays(5)->toDateString(),
            'notes' => 'Referente a Janeiro',
        ];

        $response = $this->postJson('/api/v1/accounts-payable', $data);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'description' => 'Conta de Luz',
                'amount' => '150.50',
                'status' => AccountPayable::STATUS_PENDING,
            ]);

        $this->assertDatabaseHas('accounts_payable', [
            'description' => 'Conta de Luz',
            'amount' => '150.50',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_cannot_access_other_tenant_payable()
    {

        $otherPayable = AccountPayable::factory()->create([
            'tenant_id' => $this->otherTenant->id,
        ]);

        // Attempt verify show
        $this->getJson("/api/v1/accounts-payable/{$otherPayable->id}")
            ->assertStatus(404); // Expect 404 due to global scope or 403 explicit check

        // Attempt update
        $this->putJson("/api/v1/accounts-payable/{$otherPayable->id}", ['description' => 'Hacked'])
            ->assertStatus(404);
            
        // Attempt delete
        $this->deleteJson("/api/v1/accounts-payable/{$otherPayable->id}")
            ->assertStatus(404);
    }

    // --- CATEGORY TESTS (Checking Security Issues) ---

    // Este teste deve FALHAR antes da correcao P0 ser aplicada
    public function test_categories_are_scoped_to_tenant()
    {

        $myCat = AccountPayableCategory::factory()->create(['tenant_id' => $this->tenant->id, 'name' => 'Minha Categoria']);
        $otherCat = AccountPayableCategory::factory()->create(['tenant_id' => $this->otherTenant->id, 'name' => 'Outra Categoria']);

        $response = $this->getJson('/api/v1/account-payable-categories');
        
        $response->assertOk();
        // Se a correcao P0 ainda nao foi feita, isso pode falhar se o controller nao filtrar
        $response->assertJsonFragment(['name' => 'Minha Categoria'])
                 ->assertJsonMissing(['name' => 'Outra Categoria']);
    }

    public function test_store_category_assigns_tenant_id()
    {

        $response = $this->postJson('/api/v1/account-payable-categories', [
            'name' => 'Nova Cat',
            'color' => '#ffffff',
        ]);

        $response->assertStatus(201);
        
        // Verifica se gravou com o tenant correto
        $this->assertDatabaseHas('account_payable_categories', [
            'name' => 'Nova Cat',
            'tenant_id' => $this->tenant->id,
        ]);
        
        // Verifica se nao gravou com tenant null ou 0 (comum quando esquece o assign)
    }

    public function test_cannot_delete_category_with_payables()
    {

        $cat = AccountPayableCategory::factory()->create(['tenant_id' => $this->tenant->id]);
        AccountPayable::factory()->create([
            'tenant_id' => $this->tenant->id,
            'category_id' => $cat->id,
        ]);

        $this->deleteJson("/api/v1/account-payable-categories/{$cat->id}")
            ->assertStatus(422); // Unprocessable Entity
            
        $this->assertDatabaseHas('account_payable_categories', ['id' => $cat->id]);
    }

    // --- PAYMENT TESTS ---

    public function test_can_pay_account_payable()
    {

        $payable = AccountPayable::factory()->create([
            'tenant_id' => $this->tenant->id,
            'amount' => 200,
            'status' => AccountPayable::STATUS_PENDING,
        ]);

        $response = $this->postJson("/api/v1/accounts-payable/{$payable->id}/pay", [
            'amount' => 200,
            'payment_method' => 'pix',
            'payment_date' => now()->toDateString(),
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('accounts_payable', [
            'id' => $payable->id,
            'status' => AccountPayable::STATUS_PAID,
            'amount_paid' => 200.00,
        ]);
    }
}
