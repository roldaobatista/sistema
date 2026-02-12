<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExpenseCategory extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes, Auditable;

    protected $fillable = ['tenant_id', 'name', 'color', 'active', 'budget_limit'];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'budget_limit' => 'decimal:2',
        ];
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }
}
