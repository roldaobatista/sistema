<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChartOfAccount extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'parent_id', 'code', 'name', 'type', 'is_system', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public const TYPE_REVENUE = 'revenue';
    public const TYPE_EXPENSE = 'expense';
    public const TYPE_ASSET = 'asset';
    public const TYPE_LIABILITY = 'liability';

    public const TYPES = [
        self::TYPE_REVENUE => 'Receita',
        self::TYPE_EXPENSE => 'Despesa',
        self::TYPE_ASSET => 'Ativo',
        self::TYPE_LIABILITY => 'Passivo',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function receivables(): HasMany
    {
        return $this->hasMany(AccountReceivable::class, 'chart_of_account_id');
    }

    public function payables(): HasMany
    {
        return $this->hasMany(AccountPayable::class, 'chart_of_account_id');
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'chart_of_account_id');
    }
}
