<?php

namespace Tests\Unit;

use App\Models\BankStatementEntry;
use App\Models\ReconciliationRule;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReconciliationRuleEngineTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function makeEntry(array $overrides = []): BankStatementEntry
    {
        return new BankStatementEntry(array_merge([
            'description' => 'Pagamento CNPJ 12.345.678/0001-90 referencia ABC',
            'amount' => 1500.00,
            'type' => 'credit',
            'status' => 'pending',
        ], $overrides));
    }

    private function makeRule(array $overrides = []): ReconciliationRule
    {
        return new ReconciliationRule(array_merge([
            'tenant_id' => $this->tenant->id,
            'name' => 'Test Rule',
            'match_field' => 'description',
            'match_operator' => 'contains',
            'match_value' => 'cnpj 12.345',
            'action' => 'categorize',
            'category' => 'Calibração',
            'priority' => 10,
            'is_active' => true,
            'times_applied' => 0,
        ], $overrides));
    }

    // ─── Contains Operator ──────────────────────────

    public function test_contains_matches_substring(): void
    {
        $rule = $this->makeRule(['match_operator' => 'contains', 'match_value' => 'cnpj 12.345']);
        $entry = $this->makeEntry();

        $this->assertTrue($rule->matches($entry));
    }

    public function test_contains_is_case_insensitive(): void
    {
        $rule = $this->makeRule(['match_operator' => 'contains', 'match_value' => 'CNPJ 12.345']);
        $entry = $this->makeEntry(['description' => 'pagamento cnpj 12.345.678 ref xyz']);

        $this->assertTrue($rule->matches($entry));
    }

    public function test_contains_rejects_non_matching(): void
    {
        $rule = $this->makeRule(['match_operator' => 'contains', 'match_value' => 'fornecedor xyz']);
        $entry = $this->makeEntry(['description' => 'pagamento cliente abc']);

        $this->assertFalse($rule->matches($entry));
    }

    // ─── Equals Operator ────────────────────────────

    public function test_equals_matches_exact_string(): void
    {
        $rule = $this->makeRule(['match_operator' => 'equals', 'match_value' => 'transferencia pix']);
        $entry = $this->makeEntry(['description' => 'transferencia pix']);

        $this->assertTrue($rule->matches($entry));
    }

    public function test_equals_rejects_partial_match(): void
    {
        $rule = $this->makeRule(['match_operator' => 'equals', 'match_value' => 'transferencia pix']);
        $entry = $this->makeEntry(['description' => 'transferencia pix para empresa']);

        $this->assertFalse($rule->matches($entry));
    }

    // ─── Regex Operator ─────────────────────────────

    public function test_regex_matches_pattern(): void
    {
        $rule = $this->makeRule(['match_operator' => 'regex', 'match_value' => 'cnpj\\s+\\d{2}\\.\\d{3}']);
        $entry = $this->makeEntry(['description' => 'pagamento CNPJ 12.345']);

        $this->assertTrue($rule->matches($entry));
    }

    public function test_regex_rejects_non_matching_pattern(): void
    {
        $rule = $this->makeRule(['match_operator' => 'regex', 'match_value' => '^fatura\\d+']);
        $entry = $this->makeEntry(['description' => 'pagamento regular']);

        $this->assertFalse($rule->matches($entry));
    }

    // ─── Amount Matching (between) ──────────────────

    public function test_between_matches_amount_in_range(): void
    {
        $rule = $this->makeRule([
            'match_field' => 'amount',
            'match_operator' => 'between',
            'match_amount_min' => 1000,
            'match_amount_max' => 2000,
        ]);
        $entry = $this->makeEntry(['amount' => 1500.00]);

        $this->assertTrue($rule->matches($entry));
    }

    public function test_between_matches_boundary_values(): void
    {
        $rule = $this->makeRule([
            'match_field' => 'amount',
            'match_operator' => 'between',
            'match_amount_min' => 100,
            'match_amount_max' => 100,
        ]);
        $entry = $this->makeEntry(['amount' => 100.00]);

        $this->assertTrue($rule->matches($entry));
    }

    public function test_between_rejects_out_of_range(): void
    {
        $rule = $this->makeRule([
            'match_field' => 'amount',
            'match_operator' => 'between',
            'match_amount_min' => 100,
            'match_amount_max' => 200,
        ]);
        $entry = $this->makeEntry(['amount' => 500.00]);

        $this->assertFalse($rule->matches($entry));
    }

    public function test_amount_uses_absolute_value(): void
    {
        $rule = $this->makeRule([
            'match_field' => 'amount',
            'match_operator' => 'between',
            'match_amount_min' => 100,
            'match_amount_max' => 200,
        ]);
        $entry = $this->makeEntry(['amount' => -150.00]);

        $this->assertTrue($rule->matches($entry));
    }

    // ─── Combined Matching ──────────────────────────

    public function test_combined_requires_both_field_and_amount(): void
    {
        // Combined now always uses str_contains for text + amount range for amount
        $rule = $this->makeRule([
            'match_field' => 'combined',
            'match_operator' => 'contains',
            'match_value' => 'cnpj 12.345',
            'match_amount_min' => 1000,
            'match_amount_max' => 2000,
        ]);

        // Both match
        $entry1 = $this->makeEntry(['description' => 'pagamento cnpj 12.345', 'amount' => 1500]);
        $this->assertTrue($rule->matches($entry1));

        // Description matches but amount doesn't
        $entry2 = $this->makeEntry(['description' => 'pagamento cnpj 12.345', 'amount' => 5000]);
        $this->assertFalse($rule->matches($entry2));

        // Amount matches but description doesn't
        $entry3 = $this->makeEntry(['description' => 'outro fornecedor', 'amount' => 1500]);
        $this->assertFalse($rule->matches($entry3));
    }

    // ─── Edge Cases ─────────────────────────────────

    public function test_empty_match_value_returns_false(): void
    {
        $rule = $this->makeRule(['match_value' => '']);
        $entry = $this->makeEntry();

        $this->assertFalse($rule->matches($entry));
    }

    public function test_amount_equals_matches_with_tolerance(): void
    {
        $rule = $this->makeRule([
            'match_field' => 'amount',
            'match_operator' => 'equals',
            'match_value' => '150.00',
        ]);

        $entry = $this->makeEntry(['amount' => 150.005]);
        $this->assertTrue($rule->matches($entry));
    }
}
