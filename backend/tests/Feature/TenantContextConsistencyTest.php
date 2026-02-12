<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\ChartOfAccount;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantContextConsistencyTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $baseTenant;
    private Tenant $currentTenant;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $this->baseTenant = Tenant::factory()->create();
        $this->currentTenant = Tenant::factory()->create();

        $this->user = User::factory()->create([
            'tenant_id' => $this->baseTenant->id,
            'current_tenant_id' => $this->currentTenant->id,
            'is_active' => true,
        ]);

        app()->instance('current_tenant_id', $this->currentTenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    public function test_chart_of_accounts_index_uses_current_tenant_context(): void
    {
        ChartOfAccount::withoutGlobalScopes()->create([
            'tenant_id' => $this->currentTenant->id,
            'code' => '1.1.1',
            'name' => 'Receita atual',
            'type' => 'revenue',
            'is_system' => false,
            'is_active' => true,
        ]);

        ChartOfAccount::withoutGlobalScopes()->create([
            'tenant_id' => $this->baseTenant->id,
            'code' => '9.9.9',
            'name' => 'Receita base',
            'type' => 'revenue',
            'is_system' => false,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/chart-of-accounts');

        $response->assertOk()
            ->assertJsonFragment(['name' => 'Receita atual'])
            ->assertJsonMissing(['name' => 'Receita base']);
    }

    public function test_chart_of_accounts_update_rejects_self_parent(): void
    {
        $account = ChartOfAccount::create([
            'tenant_id' => $this->currentTenant->id,
            'code' => '2.1.0',
            'name' => 'Conta operacional',
            'type' => 'expense',
            'is_system' => false,
            'is_active' => true,
        ]);

        $response = $this->putJson("/api/v1/chart-of-accounts/{$account->id}", [
            'parent_id' => $account->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Uma conta nao pode ser pai dela mesma.');
    }

    public function test_bank_reconciliation_statements_uses_current_tenant_context(): void
    {
        BankStatement::withoutGlobalScopes()->create([
            'tenant_id' => $this->currentTenant->id,
            'filename' => 'atual.ofx',
            'created_by' => $this->user->id,
            'total_entries' => 1,
            'matched_entries' => 0,
        ]);

        BankStatement::withoutGlobalScopes()->create([
            'tenant_id' => $this->baseTenant->id,
            'filename' => 'base.ofx',
            'created_by' => $this->user->id,
            'total_entries' => 1,
            'matched_entries' => 0,
        ]);

        $response = $this->getJson('/api/v1/bank-reconciliation/statements');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 1)
            ->assertJsonFragment(['filename' => 'atual.ofx'])
            ->assertJsonMissing(['filename' => 'base.ofx']);
    }

    public function test_bank_reconciliation_match_rejects_cross_tenant_target(): void
    {
        $entry = BankStatementEntry::withoutGlobalScopes()->create([
            'bank_statement_id' => BankStatement::withoutGlobalScopes()->create([
                'tenant_id' => $this->currentTenant->id,
                'filename' => 'match.ofx',
                'created_by' => $this->user->id,
                'total_entries' => 1,
                'matched_entries' => 0,
            ])->id,
            'tenant_id' => $this->currentTenant->id,
            'date' => now()->toDateString(),
            'description' => 'Entrada para conciliar',
            'amount' => 100,
            'type' => 'credit',
            'status' => BankStatementEntry::STATUS_PENDING,
        ]);

        $baseTenantUser = User::factory()->create([
            'tenant_id' => $this->baseTenant->id,
            'current_tenant_id' => $this->baseTenant->id,
            'is_active' => true,
        ]);

        $crossTenantPayable = AccountPayable::withoutGlobalScopes()->create([
            'tenant_id' => $this->baseTenant->id,
            'created_by' => $baseTenantUser->id,
            'description' => 'Conta de outro tenant',
            'amount' => 150,
            'amount_paid' => 0,
            'due_date' => now()->addDay()->toDateString(),
            'status' => AccountPayable::STATUS_PENDING,
        ]);

        $response = $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => AccountPayable::class,
            'matched_id' => $crossTenantPayable->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Registro financeiro para conciliacao nao encontrado neste tenant.');
    }
}
