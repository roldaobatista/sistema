<?php

namespace Tests\Feature;

use App\Models\AccountReceivable;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReconciliationAuditAndDashboardTest extends TestCase
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

    private function createStatementWithEntries(int $count = 3): BankStatement
    {
        $statement = BankStatement::create([
            'tenant_id' => $this->tenant->id,
            'filename' => 'audit-test.ofx',
            'imported_at' => now(),
            'created_by' => $this->user->id,
            'total_entries' => $count,
            'matched_entries' => 0,
        ]);

        for ($i = 1; $i <= $count; $i++) {
            BankStatementEntry::create([
                'bank_statement_id' => $statement->id,
                'tenant_id' => $this->tenant->id,
                'date' => now()->subDays($i)->toDateString(),
                'description' => "Lançamento {$i}",
                'amount' => $i * 100.00,
                'type' => $i % 2 === 0 ? 'debit' : 'credit',
                'status' => BankStatementEntry::STATUS_PENDING,
            ]);
        }

        return $statement;
    }

    private function createReceivable(float $amount = 100.00): AccountReceivable
    {
        return AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'description' => 'Titulo teste',
            'amount' => $amount,
            'amount_paid' => 0,
            'due_date' => now()->toDateString(),
            'status' => AccountReceivable::STATUS_PENDING,
        ]);
    }

    // ─── Audit Trail Tests ──────────────────────────

    public function test_manual_match_records_audit_fields(): void
    {
        $statement = $this->createStatementWithEntries(1);
        $entry = $statement->entries->first();
        $receivable = $this->createReceivable((float) $entry->amount);

        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => 'receivable',
            'matched_id' => $receivable->id,
        ])->assertOk();

        $entry->refresh();
        $this->assertSame('manual', $entry->reconciled_by);
        $this->assertNotNull($entry->reconciled_at);
        $this->assertSame($this->user->id, $entry->reconciled_by_user_id);
    }

    public function test_unmatch_clears_match_fields(): void
    {
        $statement = $this->createStatementWithEntries(1);
        $entry = $statement->entries->first();
        $receivable = $this->createReceivable((float) $entry->amount);

        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => 'receivable',
            'matched_id' => $receivable->id,
        ])->assertOk();

        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/unmatch")
            ->assertOk();

        $entry->refresh();
        $this->assertSame(BankStatementEntry::STATUS_PENDING, $entry->status);
        $this->assertNull($entry->matched_type);
        $this->assertNull($entry->matched_id);
    }

    // ─── Dashboard Tests ────────────────────────────

    public function test_dashboard_returns_kpi_structure(): void
    {
        $this->createStatementWithEntries(3);

        $response = $this->getJson('/api/v1/bank-reconciliation/dashboard');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'kpis' => [
                        'total_entries',
                        'pending',
                        'matched',
                        'ignored',
                        'auto_matched',
                        'total_credits',
                        'total_debits',
                        'reconciliation_rate',
                    ],
                    'status_distribution',
                    'weekly_data',
                    'daily_progress',
                    'categories',
                    'top_unreconciled',
                ],
            ]);
    }

    public function test_dashboard_kpis_reflect_entry_counts(): void
    {
        $this->createStatementWithEntries(3);

        $response = $this->getJson('/api/v1/bank-reconciliation/dashboard');

        $kpis = $response->json('data.kpis');
        $this->assertEquals(3, $kpis['total_entries']);
        $this->assertEquals(3, $kpis['pending']);
        $this->assertEquals(0, $kpis['matched']);
    }

    public function test_dashboard_rate_updates_after_match(): void
    {
        $statement = $this->createStatementWithEntries(2);
        $entry = $statement->entries->first();
        $receivable = $this->createReceivable((float) $entry->amount);

        $this->postJson("/api/v1/bank-reconciliation/entries/{$entry->id}/match", [
            'matched_type' => 'receivable',
            'matched_id' => $receivable->id,
        ])->assertOk();

        $response = $this->getJson('/api/v1/bank-reconciliation/dashboard');

        $kpis = $response->json('data.kpis');
        $this->assertEquals(1, $kpis['matched']);
        $this->assertEquals(50.0, $kpis['reconciliation_rate']);
    }

    public function test_dashboard_with_no_data_returns_zeros(): void
    {
        $response = $this->getJson('/api/v1/bank-reconciliation/dashboard');

        $response->assertOk();
        $kpis = $response->json('data.kpis');
        $this->assertEquals(0, $kpis['total_entries']);
        $this->assertEquals(0, $kpis['reconciliation_rate']);
    }

    public function test_dashboard_filters_by_date_range(): void
    {
        $statement = BankStatement::create([
            'tenant_id' => $this->tenant->id,
            'filename' => 'range.ofx',
            'imported_at' => now(),
            'created_by' => $this->user->id,
            'total_entries' => 2,
            'matched_entries' => 0,
        ]);

        // Entry within last 30 days
        BankStatementEntry::create([
            'bank_statement_id' => $statement->id,
            'tenant_id' => $this->tenant->id,
            'date' => now()->subDays(5)->toDateString(),
            'description' => 'Recente',
            'amount' => 100,
            'type' => 'credit',
            'status' => 'pending',
        ]);

        // Entry 60 days ago (outside default 30-day range)
        BankStatementEntry::create([
            'bank_statement_id' => $statement->id,
            'tenant_id' => $this->tenant->id,
            'date' => now()->subDays(60)->toDateString(),
            'description' => 'Antigo',
            'amount' => 200,
            'type' => 'debit',
            'status' => 'pending',
        ]);

        // Default: last 30 days
        $response = $this->getJson('/api/v1/bank-reconciliation/dashboard');
        $this->assertEquals(1, $response->json('data.kpis.total_entries'));

        // Expanded range: 90 days
        $start = now()->subDays(90)->toDateString();
        $end = now()->toDateString();
        $response2 = $this->getJson("/api/v1/bank-reconciliation/dashboard?start_date={$start}&end_date={$end}");
        $this->assertEquals(2, $response2->json('data.kpis.total_entries'));
    }
}
