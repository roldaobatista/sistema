<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BankReconciliationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;

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
        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    private function createStatementWithEntry(): array
    {
        $statement = BankStatement::create([
            'tenant_id' => $this->tenant->id,
            'filename' => 'statement.ofx',
            'imported_at' => now(),
            'created_by' => $this->user->id,
            'total_entries' => 1,
            'matched_entries' => 0,
        ]);

        $entry = BankStatementEntry::create([
            'bank_statement_id' => $statement->id,
            'tenant_id' => $this->tenant->id,
            'date' => now()->toDateString(),
            'description' => 'Transferencia recebida',
            'amount' => 120.50,
            'type' => 'credit',
            'status' => BankStatementEntry::STATUS_PENDING,
        ]);

        return [$statement, $entry];
    }

    public function test_statements_returns_entries_count(): void
    {
        [$statement] = $this->createStatementWithEntry();

        $response = $this->getJson('/api/v1/bank-reconciliation/statements');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.id', $statement->id)
            ->assertJsonPath('data.data.0.entries_count', 1);
    }

    public function test_match_entry_accepts_alias_type_and_updates_statement_counter(): void
    {
        [$statement, $entry] = $this->createStatementWithEntry();

        $receivable = AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Titulo para conciliar',
            'amount' => 120.50,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => AccountReceivable::STATUS_PENDING,
        ]);

        $response = $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => 'receivable',
            'matched_id' => $receivable->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', BankStatementEntry::STATUS_MATCHED)
            ->assertJsonPath('data.matched_type', AccountReceivable::class)
            ->assertJsonPath('data.matched_id', $receivable->id);

        $statement->refresh();
        $this->assertSame(1, $statement->matched_entries);
    }

    public function test_ignore_entry_clears_match_and_recomputes_counter(): void
    {
        [$statement, $entry] = $this->createStatementWithEntry();

        $payable = AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Titulo para ignorar',
            'amount' => 120.50,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => AccountPayable::STATUS_PENDING,
        ]);

        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => AccountPayable::class,
            'matched_id' => $payable->id,
        ])->assertOk();

        $statement->refresh();
        $this->assertSame(1, $statement->matched_entries);

        $response = $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/ignore");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', BankStatementEntry::STATUS_IGNORED)
            ->assertJsonPath('data.matched_type', null)
            ->assertJsonPath('data.matched_id', null);

        $entry->refresh();
        $this->assertSame(BankStatementEntry::STATUS_IGNORED, $entry->status);
        $this->assertNull($entry->matched_type);
        $this->assertNull($entry->matched_id);

        $statement->refresh();
        $this->assertSame(0, $statement->matched_entries);
    }
}
