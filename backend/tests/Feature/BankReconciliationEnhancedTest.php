<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\BankAccount;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BankReconciliationEnhancedTest extends TestCase
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

    private function createStatement(array $overrides = []): BankStatement
    {
        return BankStatement::create(array_merge([
            'tenant_id' => $this->tenant->id,
            'filename' => 'test_statement.ofx',
            'imported_at' => now(),
            'created_by' => $this->user->id,
            'total_entries' => 0,
            'matched_entries' => 0,
        ], $overrides));
    }

    private function createEntry(BankStatement $statement, array $overrides = []): BankStatementEntry
    {
        $entry = BankStatementEntry::create(array_merge([
            'bank_statement_id' => $statement->id,
            'tenant_id' => $this->tenant->id,
            'date' => now()->toDateString(),
            'description' => 'Pagamento cliente ABC',
            'amount' => 250.00,
            'type' => 'credit',
            'status' => BankStatementEntry::STATUS_PENDING,
        ], $overrides));

        $statement->update(['total_entries' => $statement->entries()->count()]);

        return $entry;
    }

    private function createReceivable(array $overrides = []): AccountReceivable
    {
        return AccountReceivable::create(array_merge([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Servico calibracao',
            'amount' => 250.00,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => AccountReceivable::STATUS_PENDING,
        ], $overrides));
    }

    // ─── F3: Summary ──────────────────────────────────

    public function test_summary_returns_correct_kpis(): void
    {
        $statement = $this->createStatement();
        $this->createEntry($statement, ['status' => BankStatementEntry::STATUS_PENDING, 'amount' => 100, 'type' => 'credit']);
        $this->createEntry($statement, ['status' => BankStatementEntry::STATUS_MATCHED, 'amount' => 200, 'type' => 'credit']);
        $this->createEntry($statement, ['status' => BankStatementEntry::STATUS_IGNORED, 'amount' => -50, 'type' => 'debit']);
        $this->createEntry($statement, ['status' => BankStatementEntry::STATUS_PENDING, 'amount' => -75, 'type' => 'debit', 'possible_duplicate' => true]);

        $response = $this->getJson('/api/v1/bank-reconciliation/summary');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_entries', 4)
            ->assertJsonPath('data.pending_count', 2)
            ->assertJsonPath('data.matched_count', 1)
            ->assertJsonPath('data.ignored_count', 1)
            ->assertJsonPath('data.duplicate_count', 1);
    }

    public function test_summary_with_no_entries_returns_zeros(): void
    {
        $response = $this->getJson('/api/v1/bank-reconciliation/summary');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_entries', 0)
            ->assertJsonPath('data.pending_count', 0);
    }

    // ─── F5: Unmatch ──────────────────────────────────

    public function test_unmatch_entry_reverts_to_pending(): void
    {
        $statement = $this->createStatement();
        $entry = $this->createEntry($statement);
        $receivable = $this->createReceivable();

        // First match
        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => 'receivable',
            'matched_id' => $receivable->id,
        ])->assertOk();

        $statement->refresh();
        $this->assertSame(1, $statement->matched_entries);

        // Then unmatch
        $response = $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/unmatch");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', BankStatementEntry::STATUS_PENDING)
            ->assertJsonPath('data.matched_type', null)
            ->assertJsonPath('data.matched_id', null);

        $statement->refresh();
        $this->assertSame(0, $statement->matched_entries);
    }

    public function test_unmatch_rejects_non_matched_entry(): void
    {
        $statement = $this->createStatement();
        $entry = $this->createEntry($statement, ['status' => BankStatementEntry::STATUS_PENDING]);

        $response = $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/unmatch");

        $response->assertStatus(422);
    }

    // ─── F6: Destroy Statement ────────────────────────

    public function test_destroy_statement_deletes_all_entries(): void
    {
        $statement = $this->createStatement();
        $this->createEntry($statement);
        $this->createEntry($statement, ['description' => 'Segundo']);

        $this->assertDatabaseCount('bank_statement_entries', 2);

        $response = $this->deleteJson("/api/v1/bank-reconciliation/statements/{$statement->id}");

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('bank_statements', ['id' => $statement->id]);
        $this->assertDatabaseCount('bank_statement_entries', 0);
    }

    public function test_destroy_nonexistent_statement_returns_404(): void
    {
        $response = $this->deleteJson('/api/v1/bank-reconciliation/statements/99999');

        $response->assertStatus(404);
    }

    // ─── F7: Entries with Filters ─────────────────────

    public function test_entries_filter_by_status(): void
    {
        $statement = $this->createStatement();
        $this->createEntry($statement, ['status' => BankStatementEntry::STATUS_PENDING, 'description' => 'Pendente']);
        $this->createEntry($statement, ['status' => BankStatementEntry::STATUS_MATCHED, 'description' => 'Conciliado']);
        $this->createEntry($statement, ['status' => BankStatementEntry::STATUS_IGNORED, 'description' => 'Ignorado']);

        $response = $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/entries?status=matched");

        $response->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.status', 'matched');
    }

    public function test_entries_filter_by_type(): void
    {
        $statement = $this->createStatement();
        $this->createEntry($statement, ['type' => 'credit', 'amount' => 100]);
        $this->createEntry($statement, ['type' => 'debit', 'amount' => -50]);

        $response = $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/entries?type=debit");

        $response->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.type', 'debit');
    }

    public function test_entries_filter_by_search(): void
    {
        $statement = $this->createStatement();
        $this->createEntry($statement, ['description' => 'Pagamento empresa XYZ']);
        $this->createEntry($statement, ['description' => 'Transferencia bancaria']);

        $response = $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/entries?search=XYZ");

        $response->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.description', 'Pagamento empresa XYZ');
    }

    public function test_entries_filter_duplicates_only(): void
    {
        $statement = $this->createStatement();
        $this->createEntry($statement, ['possible_duplicate' => true, 'description' => 'Duplicata']);
        $this->createEntry($statement, ['possible_duplicate' => false, 'description' => 'Normal']);

        $response = $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/entries?duplicates_only=1");

        $response->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.description', 'Duplicata');
    }

    public function test_entries_filter_by_amount_range(): void
    {
        $statement = $this->createStatement();
        $this->createEntry($statement, ['amount' => 50, 'description' => 'Pequeno']);
        $this->createEntry($statement, ['amount' => 500, 'description' => 'Grande']);

        $response = $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/entries?min_amount=100&max_amount=600");

        $response->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.description', 'Grande');
    }

    // ─── F8: Bulk Action ──────────────────────────────

    public function test_bulk_ignore_multiple_entries(): void
    {
        $statement = $this->createStatement();
        $e1 = $this->createEntry($statement, ['description' => 'Entry 1']);
        $e2 = $this->createEntry($statement, ['description' => 'Entry 2']);

        $response = $this->postJson('/api/v1/bank-reconciliation/bulk-action', [
            'action' => 'ignore',
            'entry_ids' => [$e1->id, $e2->id],
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.processed', 2)
            ->assertJsonPath('data.total', 2);

        $e1->refresh();
        $e2->refresh();
        $this->assertSame(BankStatementEntry::STATUS_IGNORED, $e1->status);
        $this->assertSame(BankStatementEntry::STATUS_IGNORED, $e2->status);
    }

    public function test_bulk_unmatch_reverts_matched_entries(): void
    {
        $statement = $this->createStatement();
        $entry = $this->createEntry($statement);
        $receivable = $this->createReceivable();

        // Match first
        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => 'receivable',
            'matched_id' => $receivable->id,
        ])->assertOk();

        // Bulk unmatch
        $response = $this->postJson('/api/v1/bank-reconciliation/bulk-action', [
            'action' => 'unmatch',
            'entry_ids' => [$entry->id],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.processed', 1);

        $entry->refresh();
        $this->assertSame(BankStatementEntry::STATUS_PENDING, $entry->status);
        $this->assertNull($entry->matched_type);
    }

    public function test_bulk_action_validates_required_fields(): void
    {
        $response = $this->postJson('/api/v1/bank-reconciliation/bulk-action', []);

        $response->assertStatus(422);
    }

    public function test_bulk_action_rejects_invalid_action(): void
    {
        $statement = $this->createStatement();
        $entry = $this->createEntry($statement);

        $response = $this->postJson('/api/v1/bank-reconciliation/bulk-action', [
            'action' => 'invalid_action',
            'entry_ids' => [$entry->id],
        ]);

        $response->assertStatus(422);
    }

    // ─── F9: Export Statement ─────────────────────────

    public function test_export_statement_returns_data(): void
    {
        $statement = $this->createStatement();
        $this->createEntry($statement, ['description' => 'Export test', 'amount' => 300]);

        $response = $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/export");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'statement',
                    'entries',
                    'summary',
                ],
            ]);
    }

    public function test_export_nonexistent_statement_returns_404(): void
    {
        $response = $this->getJson('/api/v1/bank-reconciliation/statements/99999/export');

        $response->assertStatus(404);
    }

    // ─── F4: Suggestions ──────────────────────────────

    public function test_suggestions_returns_matching_receivables(): void
    {
        $statement = $this->createStatement();
        $entry = $this->createEntry($statement, ['amount' => 500, 'type' => 'credit']);

        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Calibracao similar',
            'amount' => 500,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => AccountReceivable::STATUS_PENDING,
        ]);

        $response = $this->getJson("/api/v1/bank-reconciliation/entries/{$entry->id}/suggestions");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => [['id', 'type', 'description', 'amount', 'score']]]);
    }

    public function test_suggestions_for_nonexistent_entry_returns_error(): void
    {
        $response = $this->getJson('/api/v1/bank-reconciliation/entries/99999/suggestions');

        // findOrFail lança ModelNotFoundException → 500 (tratado pelo catch genérico)
        $response->assertStatus(500);
    }

    // ─── F2: Search Financials ────────────────────────

    public function test_search_financials_finds_receivable_by_description(): void
    {
        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Calibracao balanca industrial',
            'amount' => 1200,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => AccountReceivable::STATUS_PENDING,
        ]);

        $response = $this->getJson('/api/v1/bank-reconciliation/search-financials?q=calibracao&type=receivable');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $results = $response->json('data');
        $this->assertNotEmpty($results);
        $this->assertStringContainsStringIgnoringCase('calibracao', $results[0]['description']);
    }

    public function test_search_financials_rejects_short_query(): void
    {
        $response = $this->getJson('/api/v1/bank-reconciliation/search-financials?q=a&type=receivable');

        // Controller valida min:2 — query de 1 char é rejeitada
        $response->assertStatus(422);
    }

    // ─── F1: Bank Account Linking ─────────────────────

    public function test_statements_include_bank_account_relationship(): void
    {
        $bankAccount = BankAccount::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $this->createStatement(['bank_account_id' => $bankAccount->id]);

        $response = $this->getJson('/api/v1/bank-reconciliation/statements');

        $response->assertOk()
            ->assertJsonPath('data.data.0.bank_account_id', $bankAccount->id);
    }
}
