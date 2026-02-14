<?php

namespace Tests\Unit;

use App\Models\CommissionRule;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PROFESSIONAL Unit Tests — CommissionRule Model
 *
 * Tests every calculation_type directly on the model with exact expected values.
 * This is a pure unit test — no services, no HTTP, just the calculation method.
 */
class CommissionRuleCalculationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
    }

    private function makeRule(string $calcType, float $value, array $extra = []): CommissionRule
    {
        return CommissionRule::create(array_merge([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => "Rule {$calcType}",
            'type' => 'percentage',
            'value' => $value,
            'calculation_type' => $calcType,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_to' => CommissionRule::APPLIES_ALL,
            'active' => true,
            'priority' => 1,
        ], $extra));
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_PERCENT_GROSS — % do bruto
    // ═══════════════════════════════════════════════════════════

    public function test_percent_gross(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_GROSS, 5.00);
        $this->assertEquals(250.00, $rule->calculateCommission(5000.00));
    }

    public function test_percent_gross_with_decimals(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_GROSS, 7.50);
        $this->assertEquals(375.00, $rule->calculateCommission(5000.00));
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_PERCENT_NET — % líquido (bruto - despesas - custo)
    // ═══════════════════════════════════════════════════════════

    public function test_percent_net(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_NET, 10.00);
        $result = $rule->calculateCommission(10000.00, [
            'expenses' => 1000.00,
            'cost' => 2000.00,
        ]);
        // (10000 - 1000 - 2000) * 10% = 700
        $this->assertEquals(700.00, $result);
    }

    public function test_percent_net_without_context_defaults_to_zero(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_NET, 10.00);
        $result = $rule->calculateCommission(5000.00);
        // (5000 - 0 - 0) * 10% = 500
        $this->assertEquals(500.00, $result);
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_PERCENT_GROSS_MINUS_DISPLACEMENT — % (bruto - deslocamento)
    // ═══════════════════════════════════════════════════════════

    public function test_percent_gross_minus_displacement(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_GROSS_MINUS_DISPLACEMENT, 5.00);
        $result = $rule->calculateCommission(5000.00, ['displacement' => 300.00]);
        // (5000 - 300) * 5% = 235
        $this->assertEquals(235.00, $result);
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_PERCENT_SERVICES_ONLY — % somente serviços
    // ═══════════════════════════════════════════════════════════

    public function test_percent_services_only(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_SERVICES_ONLY, 10.00);
        $result = $rule->calculateCommission(8000.00, ['services_total' => 5000.00]);
        // 5000 * 10% = 500
        $this->assertEquals(500.00, $result);
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_PERCENT_PRODUCTS_ONLY — % somente produtos
    // ═══════════════════════════════════════════════════════════

    public function test_percent_products_only(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_PRODUCTS_ONLY, 8.00);
        $result = $rule->calculateCommission(10000.00, ['products_total' => 4000.00]);
        // 4000 * 8% = 320
        $this->assertEquals(320.00, $result);
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_FIXED_PER_OS — valor fixo
    // ═══════════════════════════════════════════════════════════

    public function test_fixed_per_os(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_FIXED_PER_OS, 150.00);
        $this->assertEquals(150.00, $rule->calculateCommission(5000.00));
        $this->assertEquals(150.00, $rule->calculateCommission(100000.00));
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_PERCENT_PROFIT — % lucro (bruto - custo)
    // ═══════════════════════════════════════════════════════════

    public function test_percent_profit(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_PROFIT, 10.00);
        $result = $rule->calculateCommission(10000.00, ['cost' => 6000.00]);
        // (10000 - 6000) * 10% = 400
        $this->assertEquals(400.00, $result);
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_PERCENT_GROSS_MINUS_EXPENSES — % (bruto - despesas OS)
    // ═══════════════════════════════════════════════════════════

    public function test_percent_gross_minus_expenses(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_GROSS_MINUS_EXPENSES, 5.00);
        $result = $rule->calculateCommission(8000.00, ['expenses' => 1500.00]);
        // (8000 - 1500) * 5% = 325
        $this->assertEquals(325.00, $result);
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_TIERED_GROSS — escalonado progressivo
    // ═══════════════════════════════════════════════════════════

    public function test_tiered_gross_progressive(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_TIERED_GROSS, 0, [
            'tiers' => [
                ['up_to' => 5000, 'percent' => 3],
                ['up_to' => 10000, 'percent' => 5],
                ['up_to' => null, 'percent' => 8],
            ],
        ]);

        // R$12.000:
        // 0-5000: 5000 * 3% = 150
        // 5000-10000: 5000 * 5% = 250
        // 10000+: 2000 * 8% = 160
        // Total: 560
        $this->assertEquals(560.00, $rule->calculateCommission(12000.00));
    }

    public function test_tiered_within_first_tier(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_TIERED_GROSS, 0, [
            'tiers' => [
                ['up_to' => 5000, 'percent' => 3],
                ['up_to' => 10000, 'percent' => 5],
            ],
        ]);

        // R$3.000 (only first tier applies): 3000 * 3% = 90
        $this->assertEquals(90.00, $rule->calculateCommission(3000.00));
    }

    // ═══════════════════════════════════════════════════════════
    // CALC_CUSTOM_FORMULA — fórmula personalizada
    // ═══════════════════════════════════════════════════════════

    public function test_custom_formula_simple(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_CUSTOM_FORMULA, 5, [
            'tiers' => ['formula' => '(gross - expenses) * percent / 100'],
        ]);

        $result = $rule->calculateCommission(10000.00, [
            'gross' => 10000.00,
            'expenses' => 2000.00,
        ]);

        // (10000 - 2000) * 5 / 100 = 400
        $this->assertEquals(400.00, $result);
    }

    public function test_custom_formula_without_formula_falls_back_to_percent(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_CUSTOM_FORMULA, 10, [
            'tiers' => null,
        ]);

        // Fallback: 5000 * 10% = 500
        $this->assertEquals(500.00, $rule->calculateCommission(5000.00));
    }

    // ═══════════════════════════════════════════════════════════
    // EDGE CASES
    // ═══════════════════════════════════════════════════════════

    public function test_zero_base_amount_returns_zero(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_GROSS, 10.00);
        $this->assertEquals(0.00, $rule->calculateCommission(0.00));
    }

    public function test_rounding_precision_to_2_decimals(): void
    {
        $rule = $this->makeRule(CommissionRule::CALC_PERCENT_GROSS, 3.33);
        // 10000 * 3.33% = 333.00
        $result = $rule->calculateCommission(10000.00);
        $this->assertEquals(333.00, $result);
    }

    public function test_legacy_percentage_fallback(): void
    {
        $rule = $this->makeRule('unknown_type', 5.00, [
            'type' => CommissionRule::TYPE_PERCENTAGE,
        ]);
        // Falls back to legacy: 5000 * 5% = 250
        $this->assertEquals(250.00, $rule->calculateCommission(5000.00));
    }

    public function test_legacy_fixed_fallback(): void
    {
        $rule = $this->makeRule('unknown_type', 200.00, [
            'type' => CommissionRule::TYPE_FIXED,
        ]);
        // Falls back to fixed: 200
        $this->assertEquals(200.00, $rule->calculateCommission(5000.00));
    }
}
