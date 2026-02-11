<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class PriceHistory extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'priceable_type',
        'priceable_id',
        'old_cost_price',
        'new_cost_price',
        'old_sell_price',
        'new_sell_price',
        'change_percent',
        'reason',
        'changed_by',
    ];

    protected function casts(): array
    {
        return [
            'old_cost_price' => 'decimal:2',
            'new_cost_price' => 'decimal:2',
            'old_sell_price' => 'decimal:2',
            'new_sell_price' => 'decimal:2',
            'change_percent' => 'decimal:2',
        ];
    }

    public function priceable(): MorphTo
    {
        return $this->morphTo();
    }

    public function changedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
