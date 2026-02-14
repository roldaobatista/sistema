<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransfer extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'reference', 'from_warehouse_id', 'to_warehouse_id',
        'status', 'notes', 'transferred_by', 'transferred_at',
    ];

    protected $casts = [
        'transferred_at' => 'datetime',
    ];

    public function fromWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'from_warehouse_id');
    }

    public function toWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'to_warehouse_id');
    }
}
