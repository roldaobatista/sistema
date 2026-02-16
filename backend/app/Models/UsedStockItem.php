<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UsedStockItem extends Model
{
    use BelongsToTenant;

    public const STATUS_PENDING_RETURN = 'pending_return';
    public const STATUS_PENDING_CONFIRMATION = 'pending_confirmation';
    public const STATUS_RETURNED = 'returned';
    public const STATUS_WRITTEN_OFF_NO_RETURN = 'written_off_no_return';

    protected $fillable = [
        'tenant_id',
        'work_order_id',
        'work_order_item_id',
        'product_id',
        'technician_warehouse_id',
        'quantity',
        'status',
        'reported_by',
        'reported_at',
        'disposition_type',
        'disposition_notes',
        'confirmed_by',
        'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'reported_at' => 'datetime',
            'confirmed_at' => 'datetime',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function workOrderItem(): BelongsTo
    {
        return $this->belongsTo(WorkOrderItem::class, 'work_order_item_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function technicianWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'technician_warehouse_id');
    }

    public function disposition(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(ReturnedUsedItemDisposition::class, 'used_stock_item_id');
    }
}
