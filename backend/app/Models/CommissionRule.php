<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommissionRule extends Model
{
    use BelongsToTenant, Auditable;

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
                ($baseAmount - ($context['expenses'] ?? 0)) * ($pct / 100), 2
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
        // tiers/formula stored in tiers field as: { "formula": "gross * 0.1 - expenses * 0.05" }
        // Simple safe evaluation — for now just use percent_gross as fallback
        return round($amount * ((float) $this->value / 100), 2);
    }

    /**
     * Bridge method used by CrmObserver — extracts context from a WorkOrder
     * and delegates to calculateCommission().
     */
    public function calculate(WorkOrder $wo): float
    {
        $productsTotal = $wo->items()->where('type', 'product')->sum('total');
        $servicesTotal = $wo->items()->where('type', 'service')->sum('total');
        $expenses = Expense::where('work_order_id', $wo->id)->sum('amount');

        return $this->calculateCommission((float) $wo->total, [
            'gross'          => (float) $wo->total,
            'products_total' => (float) $productsTotal,
            'services_total' => (float) $servicesTotal,
            'expenses'       => (float) $expenses,
            'displacement'   => 0,
            'cost'           => 0,
        ]);
    }
}
