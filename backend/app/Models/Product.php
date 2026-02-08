<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $fillable = [
        'tenant_id',
        'category_id',
        'code',
        'name',
        'description',
        'unit',
        'cost_price',
        'sell_price',
        'stock_qty',
        'stock_min',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'cost_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
            'stock_qty' => 'decimal:2',
            'stock_min' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    /** Margem de lucro em % */
    public function getProfitMarginAttribute(): ?float
    {
        if (!$this->sell_price || $this->sell_price == 0) return null;
        if (!$this->cost_price || $this->cost_price == 0) return 100.0;
        return round((($this->sell_price - $this->cost_price) / $this->sell_price) * 100, 2);
    }

    /** Markup multiplicador */
    public function getMarkupAttribute(): ?float
    {
        if (!$this->cost_price || $this->cost_price == 0) return null;
        return round($this->sell_price / $this->cost_price, 2);
    }
}
