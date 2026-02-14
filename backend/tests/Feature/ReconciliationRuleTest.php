<?php

namespace Tests\Feature;

use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\ReconciliationRule;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReconciliationRuleTest extends TestCase
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

    private function ruleData(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Regra CNPJ XYZ',
            'match_field' => 'description',
            'match_operator' => 'contains',
            'match_value' => 'cnpj 12345',
            'action' => 'categorize',
            'category' => 'Calibração',
            'priority' => 10,
            'is_active' => true,
        ], $overrides);
    }

    // ─── CRUD Tests ─────────────────────────────────

    public function test_can_list_rules(): void
    {
        ReconciliationRule::create(array_merge($this->ruleData(), ['tenant_id' => $this->tenant->id]));
        ReconciliationRule::create(array_merge($this->ruleData(['name' => 'Regra 2']), ['tenant_id' => $this->tenant->id]));

        $response = $this->getJson('/api/v1/reconciliation-rules');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 2)
            ->assertJsonCount(2, 'data.data');
    }

    public function test_can_create_rule(): void
    {
        $response = $this->postJson('/api/v1/reconciliation-rules', $this->ruleData());

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Regra CNPJ XYZ')
            ->assertJsonPath('data.match_field', 'description')
            ->assertJsonPath('data.category', 'Calibração');

        $this->assertDatabaseHas('reconciliation_rules', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Regra CNPJ XYZ',
        ]);
    }

    public function test_create_rule_validates_required_fields(): void
    {
        $response = $this->postJson('/api/v1/reconciliation-rules', []);
        $response->assertStatus(422);
    }

    public function test_can_update_rule(): void
    {
        $rule = ReconciliationRule::create(array_merge($this->ruleData(), ['tenant_id' => $this->tenant->id]));

        $response = $this->putJson("/api/v1/reconciliation-rules/{$rule->id}", [
            'name' => 'Regra Atualizada',
            'match_field' => 'amount',
            'match_operator' => 'between',
            'match_amount_min' => 100,
            'match_amount_max' => 500,
            'action' => 'ignore',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'Regra Atualizada')
            ->assertJsonPath('data.match_field', 'amount');

        $rule->refresh();
        $this->assertSame('Regra Atualizada', $rule->name);
    }

    public function test_can_delete_rule(): void
    {
        $rule = ReconciliationRule::create(array_merge($this->ruleData(), ['tenant_id' => $this->tenant->id]));

        $response = $this->deleteJson("/api/v1/reconciliation-rules/{$rule->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('reconciliation_rules', ['id' => $rule->id]);
    }

    // ─── Toggle Activation ──────────────────────────

    public function test_can_toggle_rule_activation(): void
    {
        $rule = ReconciliationRule::create(array_merge($this->ruleData(), [
            'tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]));

        $response = $this->postJson("/api/v1/reconciliation-rules/{$rule->id}/toggle");

        $response->assertOk()
            ->assertJsonPath('data.is_active', false);

        $rule->refresh();
        $this->assertFalse($rule->is_active);

        // Toggle back
        $this->postJson("/api/v1/reconciliation-rules/{$rule->id}/toggle")
            ->assertJsonPath('data.is_active', true);
    }

    // ─── Test Rule (Dry Run) ────────────────────────

    public function test_dry_run_rule(): void
    {
        $statement = BankStatement::create([
            'tenant_id' => $this->tenant->id,
            'filename' => 'test.ofx',
            'imported_at' => now(),
            'created_by' => $this->user->id,
            'total_entries' => 2,
            'matched_entries' => 0,
        ]);

        BankStatementEntry::create([
            'bank_statement_id' => $statement->id,
            'tenant_id' => $this->tenant->id,
            'date' => now()->toDateString(),
            'description' => 'Pagamento CNPJ 12345 referencia',
            'amount' => 500.00,
            'type' => 'credit',
            'status' => BankStatementEntry::STATUS_PENDING,
        ]);

        BankStatementEntry::create([
            'bank_statement_id' => $statement->id,
            'tenant_id' => $this->tenant->id,
            'date' => now()->toDateString(),
            'description' => 'Transferencia outro fornecedor',
            'amount' => 200.00,
            'type' => 'debit',
            'status' => BankStatementEntry::STATUS_PENDING,
        ]);

        $response = $this->postJson('/api/v1/reconciliation-rules/test', [
            'match_field' => 'description',
            'match_operator' => 'contains',
            'match_value' => 'cnpj 12345',
            'action' => 'categorize',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_matched', 1);

        $this->assertCount(1, $response->json('data.sample'));
    }

    // ─── Priority Ordering ──────────────────────────

    public function test_rules_sorted_by_priority(): void
    {
        ReconciliationRule::create(array_merge($this->ruleData(['name' => 'Low', 'priority' => 1]), ['tenant_id' => $this->tenant->id]));
        ReconciliationRule::create(array_merge($this->ruleData(['name' => 'High', 'priority' => 100]), ['tenant_id' => $this->tenant->id]));

        $response = $this->getJson('/api/v1/reconciliation-rules');
        $data = $response->json('data.data');

        // orderBy('priority') is ASC — lower priority number comes first
        $this->assertSame('Low', $data[0]['name']);
        $this->assertSame('High', $data[1]['name']);
    }
}
