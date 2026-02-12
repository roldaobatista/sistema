<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\ChartOfAccount;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChartOfAccountTest extends TestCase
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

    public function test_create_rejects_parent_with_different_type(): void
    {
        $parent = ChartOfAccount::create([
            'tenant_id' => $this->tenant->id,
            'code' => '2.1.001',
            'name' => 'Passivo Base',
            'type' => ChartOfAccount::TYPE_LIABILITY,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/chart-of-accounts', [
            'parent_id' => $parent->id,
            'code' => '1.1.001',
            'name' => 'Ativo Filho',
            'type' => ChartOfAccount::TYPE_ASSET,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Conta pai precisa ter o mesmo tipo da conta filha.');
    }

    public function test_create_rejects_inactive_parent(): void
    {
        $parent = ChartOfAccount::create([
            'tenant_id' => $this->tenant->id,
            'code' => '1.1.010',
            'name' => 'Pai Inativo',
            'type' => ChartOfAccount::TYPE_ASSET,
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/v1/chart-of-accounts', [
            'parent_id' => $parent->id,
            'code' => '1.1.011',
            'name' => 'Filho de Inativo',
            'type' => ChartOfAccount::TYPE_ASSET,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Nao e possivel vincular a uma conta pai inativa.');
    }

    public function test_update_rejects_hierarchy_cycle(): void
    {
        $root = ChartOfAccount::create([
            'tenant_id' => $this->tenant->id,
            'code' => '1.1.100',
            'name' => 'Conta Raiz',
            'type' => ChartOfAccount::TYPE_ASSET,
            'is_active' => true,
        ]);

        $child = ChartOfAccount::create([
            'tenant_id' => $this->tenant->id,
            'parent_id' => $root->id,
            'code' => '1.1.101',
            'name' => 'Conta Filha',
            'type' => ChartOfAccount::TYPE_ASSET,
            'is_active' => true,
        ]);

        $response = $this->putJson("/api/v1/chart-of-accounts/{$root->id}", [
            'parent_id' => $child->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Operacao invalida: geraria ciclo na hierarquia do plano de contas.');
    }

    public function test_system_account_blocks_structural_update(): void
    {
        $system = ChartOfAccount::create([
            'tenant_id' => $this->tenant->id,
            'code' => '9.9.001',
            'name' => 'Conta Sistema',
            'type' => ChartOfAccount::TYPE_REVENUE,
            'is_system' => true,
            'is_active' => true,
        ]);

        $response = $this->putJson("/api/v1/chart-of-accounts/{$system->id}", [
            'code' => '9.9.002',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Conta do sistema nao permite alteracao estrutural.');
    }

    public function test_destroy_rejects_account_used_by_financial_entries(): void
    {
        $chart = ChartOfAccount::create([
            'tenant_id' => $this->tenant->id,
            'code' => '3.1.001',
            'name' => 'Conta de Despesa',
            'type' => ChartOfAccount::TYPE_EXPENSE,
            'is_active' => true,
        ]);

        AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'chart_of_account_id' => $chart->id,
            'description' => 'Titulo vinculado',
            'amount' => 120,
            'amount_paid' => 0,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => AccountPayable::STATUS_PENDING,
        ]);

        $response = $this->deleteJson("/api/v1/chart-of-accounts/{$chart->id}");

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Nao e possivel excluir conta ja vinculada a lancamentos financeiros.');
    }

    public function test_index_filters_by_type_active_and_search(): void
    {
        ChartOfAccount::create([
            'tenant_id' => $this->tenant->id,
            'code' => '4.1.001',
            'name' => 'Receita de Servicos',
            'type' => ChartOfAccount::TYPE_REVENUE,
            'is_active' => true,
        ]);

        ChartOfAccount::create([
            'tenant_id' => $this->tenant->id,
            'code' => '5.1.001',
            'name' => 'Despesa Operacional',
            'type' => ChartOfAccount::TYPE_EXPENSE,
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/v1/chart-of-accounts?type=revenue&is_active=1&search=4.1');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', '4.1.001');
    }
}
