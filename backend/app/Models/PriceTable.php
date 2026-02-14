<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\BelongsToTenant;

class PriceTable extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'region', 'customer_type', 'multiplier',
        'is_default', 'is_active', 'valid_from', 'valid_until',
    ];

    protected $casts = [
        'multiplier' => 'decimal:4',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'valid_from' => 'date',
        'valid_until' => 'date',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(PriceTableItem::class);
    }

    public function getIsValidAttribute(): bool
    {
        $now = now()->toDateString();
        if ($this->valid_from && $this->valid_from > $now) return false;
        if ($this->valid_until && $this->valid_until < $now) return false;
        return true;
    }
}
