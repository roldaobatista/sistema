<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReconciliationRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'match_field',
        'match_operator',
        'match_value',
        'match_amount_min',
        'match_amount_max',
        'action',
        'target_type',
        'target_id',
        'category',
        'customer_id',
        'supplier_id',
        'priority',
        'is_active',
        'times_applied',
    ];

    protected $casts = [
        'match_amount_min' => 'decimal:2',
        'match_amount_max' => 'decimal:2',
        'priority' => 'integer',
        'is_active' => 'boolean',
        'times_applied' => 'integer',
    ];

    // ─── Relationships ──────────────────────────────

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    // ─── Engine ─────────────────────────────────────

    /**
     * Test if an entry matches this rule.
     */
    public function matches(BankStatementEntry $entry): bool
    {
        return match ($this->match_field) {
            'description' => $this->matchesField($entry->description),
            'amount' => $this->matchesAmount((float) $entry->amount),
            'cnpj' => $this->matchesField($entry->description),
            'combined' => $this->containsText($entry->description) && $this->matchesAmountRange((float) $entry->amount),
            default => false,
        };
    }

    /**
     * Simple text contains check used by "combined" field matching.
     */
    private function containsText(string $value): bool
    {
        $value = mb_strtolower(trim($value));
        $pattern = mb_strtolower(trim($this->match_value ?? ''));
        if ($pattern === '') return false;
        return str_contains($value, $pattern);
    }

    /**
     * Amount range check used by "combined" field matching.
     */
    private function matchesAmountRange(float $amount): bool
    {
        $absAmount = abs($amount);
        $min = (float) ($this->match_amount_min ?? 0);
        $max = (float) ($this->match_amount_max ?? PHP_FLOAT_MAX);
        return $absAmount >= $min && $absAmount <= $max;
    }

    private function matchesField(string $value): bool
    {
        $value = mb_strtolower(trim($value));
        $pattern = mb_strtolower(trim($this->match_value ?? ''));

        if ($pattern === '') return false;

        return match ($this->match_operator) {
            'contains' => str_contains($value, $pattern),
            'equals' => $value === $pattern,
            'regex' => (bool) @preg_match("/$pattern/iu", $value),
            'between' => $this->matchesAmount(0), // between só faz sentido com amount
            default => false,
        };
    }

    private function matchesAmount(float $amount): bool
    {
        $absAmount = abs($amount);

        if ($this->match_operator === 'between') {
            $min = (float) ($this->match_amount_min ?? 0);
            $max = (float) ($this->match_amount_max ?? PHP_FLOAT_MAX);
            return $absAmount >= $min && $absAmount <= $max;
        }

        if ($this->match_operator === 'equals' && $this->match_value !== null) {
            return abs($absAmount - (float) $this->match_value) < 0.01;
        }

        return true;
    }
}
