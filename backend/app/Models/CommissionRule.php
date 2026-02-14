<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommissionRule extends Model
{
    use BelongsToTenant, HasFactory, Auditable;

    protected $fillable = [
        'tenant_id', 'user_id', 'name', 'type', 'value', 'applies_to',
        'calculation_type', 'applies_to_role', 'applies_when', 'tiers', 'priority', 'active',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'active' => 'boolean',
            'tiers' => 'array',
            'priority' => 'integer',
        ];
    }

    // ── Legacy types ──
    public const TYPE_PERCENTAGE = 'percentage';
    public const TYPE_FIXED = 'fixed';

    // ── Applies to (items) ──
    public const APPLIES_ALL = 'all';
    public const APPLIES_PRODUCTS = 'products';
    public const APPLIES_SERVICES = 'services';

    // ── 10+ Calculation Types ──
    public const CALC_PERCENT_GROSS = 'percent_gross';
    public const CALC_PERCENT_NET = 'percent_net';
    public const CALC_PERCENT_GROSS_MINUS_DISPLACEMENT = 'percent_gross_minus_displacement';
    public const CALC_PERCENT_SERVICES_ONLY = 'percent_services_only';
    public const CALC_PERCENT_PRODUCTS_ONLY = 'percent_products_only';
    public const CALC_FIXED_PER_OS = 'fixed_per_os';
    public const CALC_PERCENT_PROFIT = 'percent_profit';
    public const CALC_PERCENT_GROSS_MINUS_EXPENSES = 'percent_gross_minus_expenses';
    public const CALC_TIERED_GROSS = 'tiered_gross';
    public const CALC_CUSTOM_FORMULA = 'custom_formula';

    public const CALCULATION_TYPES = [
        self::CALC_PERCENT_GROSS => '% do Bruto',
        self::CALC_PERCENT_NET => '% do Líquido (bruto − despesas)',
        self::CALC_PERCENT_GROSS_MINUS_DISPLACEMENT => '% (Bruto − Deslocamento)',
        self::CALC_PERCENT_SERVICES_ONLY => '% somente Serviços',
        self::CALC_PERCENT_PRODUCTS_ONLY => '% somente Produtos',
        self::CALC_FIXED_PER_OS => 'Fixo por OS',
        self::CALC_PERCENT_PROFIT => '% do Lucro',
        self::CALC_PERCENT_GROSS_MINUS_EXPENSES => '% (Bruto − Despesas OS)',
        self::CALC_TIERED_GROSS => '% Escalonado por faixa',
        self::CALC_CUSTOM_FORMULA => 'Fórmula Personalizada',
    ];

    // ── Roles ──
    public const ROLE_TECHNICIAN = 'technician';
    public const ROLE_SELLER = 'seller';
    public const ROLE_DRIVER = 'driver';

    // ── When to trigger ──
    public const WHEN_OS_COMPLETED = 'os_completed';
    public const WHEN_INSTALLMENT_PAID = 'installment_paid';
    public const WHEN_OS_INVOICED = 'os_invoiced';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(CommissionEvent::class);
    }

    /**
     * Calcula comissão baseado no calculation_type.
     * $context deve conter: gross, expenses, displacement, products_total, services_total, cost
     */
    public function calculateCommission(float $baseAmount, array $context = []): float
    {
        $pct = (float) $this->value;

        return match ($this->calculation_type) {
            self::CALC_PERCENT_GROSS => round($baseAmount * ($pct / 100), 2),

            self::CALC_PERCENT_NET => round(
                ($baseAmount - ($context['expenses'] ?? 0) - ($context['cost'] ?? 0)) * ($pct / 100), 2
            ),

            self::CALC_PERCENT_GROSS_MINUS_DISPLACEMENT => round(
                ($baseAmount - ($context['displacement'] ?? 0)) * ($pct / 100), 2
            ),

            self::CALC_PERCENT_SERVICES_ONLY => round(
                ($context['services_total'] ?? 0) * ($pct / 100), 2
            ),

            self::CALC_PERCENT_PRODUCTS_ONLY => round(
                ($context['products_total'] ?? 0) * ($pct / 100), 2
            ),

            self::CALC_FIXED_PER_OS => (float) $this->value,

            self::CALC_PERCENT_PROFIT => round(
                ($baseAmount - ($context['cost'] ?? 0)) * ($pct / 100), 2
            ),

            self::CALC_PERCENT_GROSS_MINUS_EXPENSES => round(
                ($baseAmount - ($context['expenses'] ?? 0)) * ($pct / 100), 2
            ),

            self::CALC_TIERED_GROSS => $this->calculateTiered($baseAmount),

            self::CALC_CUSTOM_FORMULA => $this->calculateCustom($baseAmount, $context),

            // Fallback to legacy
            default => $this->type === self::TYPE_PERCENTAGE
                ? round($baseAmount * ($pct / 100), 2)
                : (float) $this->value,
        };
    }

    private function calculateTiered(float $amount): float
    {
        $tiers = $this->tiers ?? [];
        $commission = 0;
        $remaining = $amount;

        // tiers format: [{ "up_to": 5000, "percent": 5 }, { "up_to": 10000, "percent": 8 }, { "up_to": null, "percent": 10 }]
        $prev = 0;
        foreach ($tiers as $tier) {
            $upTo = $tier['up_to'] ?? PHP_FLOAT_MAX;
            $rangeAmount = min($remaining, $upTo - $prev);
            if ($rangeAmount <= 0) break;
            $commission += round($rangeAmount * (($tier['percent'] ?? 0) / 100), 2);
            $remaining -= $rangeAmount;
            $prev = $upTo;
        }

        return $commission;
    }

    private function calculateCustom(float $amount, array $context): float
    {
        $formula = $this->tiers['formula'] ?? null;
        if (!$formula) {
            return round($amount * ((float) $this->value / 100), 2);
        }

        // Replace variables in formula
        $vars = [
            'gross' => $context['gross'] ?? $amount,
            'net' => ($context['gross'] ?? $amount) - ($context['expenses'] ?? 0),
            'products' => $context['products_total'] ?? 0,
            'services' => $context['services_total'] ?? 0,
            'expenses' => $context['expenses'] ?? 0,
            'displacement' => $context['displacement'] ?? 0,
            'cost' => $context['cost'] ?? 0,
            'percent' => (float) $this->value,
        ];

        $expr = $formula;
        foreach ($vars as $key => $val) {
            $expr = str_replace($key, (string) $val, $expr);
        }

        // Sanitize: only allow numbers, decimals, and math operators
        $expr = preg_replace('/[^0-9.+\-*\/() ]/', '', $expr);
        if (empty(trim($expr))) {
            return 0;
        }

        try {
            $result = self::safeEvaluate($expr);
            return round(max(0, (float) $result), 2);
        } catch (\Throwable) {
            return round($amount * ((float) $this->value / 100), 2);
        }
    }

    /**
     * Safe arithmetic expression evaluator (no eval).
     * Supports: +, -, *, /, parentheses, decimal numbers.
     */
    private static function safeEvaluate(string $expr): float
    {
        // Tokenize
        $tokens = [];
        preg_match_all('/(\d+\.?\d*|[+\-*\/()])/i', $expr, $matches);
        $tokens = $matches[0];

        if (empty($tokens)) {
            return 0;
        }

        $pos = 0;
        $result = self::parseExpression($tokens, $pos);

        return (float) $result;
    }

    private static function parseExpression(array &$tokens, int &$pos): float
    {
        $result = self::parseTerm($tokens, $pos);

        while ($pos < count($tokens) && in_array($tokens[$pos], ['+', '-'])) {
            $op = $tokens[$pos++];
            $right = self::parseTerm($tokens, $pos);
            $result = $op === '+' ? $result + $right : $result - $right;
        }

        return $result;
    }

    private static function parseTerm(array &$tokens, int &$pos): float
    {
        $result = self::parseFactor($tokens, $pos);

        while ($pos < count($tokens) && in_array($tokens[$pos], ['*', '/'])) {
            $op = $tokens[$pos++];
            $right = self::parseFactor($tokens, $pos);
            if ($op === '*') {
                $result *= $right;
            } else {
                $result = $right != 0 ? $result / $right : 0;
            }
        }

        return $result;
    }

    private static function parseFactor(array &$tokens, int &$pos): float
    {
        if ($pos >= count($tokens)) {
            return 0;
        }

        if ($tokens[$pos] === '(') {
            $pos++; // skip '('
            $result = self::parseExpression($tokens, $pos);
            if ($pos < count($tokens) && $tokens[$pos] === ')') {
                $pos++; // skip ')'
            }
            return $result;
        }

        return (float) $tokens[$pos++];
    }

    /**
     * Bridge method used by CrmObserver — extracts context from a WorkOrder
     * and delegates to calculateCommission().
     */
    public function calculate(WorkOrder $wo): float
    {
        $productsTotal = $wo->items()->where('type', 'product')->sum('total');
        $servicesTotal = $wo->items()->where('type', 'service')->sum('total');

        // Only expenses that affect net value should be deducted for commission calculation
        $expenses = Expense::where('tenant_id', $wo->tenant_id)
            ->where('work_order_id', $wo->id)
            ->where('affects_net_value', true)
            ->sum('amount');

        return $this->calculateCommission((float) $wo->total, [
            'gross'          => (float) $wo->total,
            'products_total' => (float) $productsTotal,
            'services_total' => (float) $servicesTotal,
            'expenses'       => (float) $expenses,
            'displacement'   => (float) ($wo->displacement_value ?? 0),
            'cost'           => 0,
        ]);
    }
}
