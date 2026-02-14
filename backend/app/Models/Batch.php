<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Batch extends Model
{
    use BelongsToTenant, Auditable, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'product_id',
        'code',
        'expires_at',
        'cost_price',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'date',
            'cost_price' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function stocks(): HasMany
    {
        return $this->hasMany(WarehouseStock::class);
    }
}
