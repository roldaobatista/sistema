<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarrantyTracking extends Model
{
    use BelongsToTenant;

    protected $table = 'warranty_tracking';

    public const TYPE_PART = 'part';
    public const TYPE_SERVICE = 'service';

    protected $fillable = [
        'tenant_id',
        'work_order_id',
        'customer_id',
        'equipment_id',
        'product_id',
        'work_order_item_id',
        'warranty_start_at',
        'warranty_end_at',
        'warranty_type',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'warranty_start_at' => 'date',
            'warranty_end_at' => 'date',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function workOrderItem(): BelongsTo
    {
        return $this->belongsTo(WorkOrderItem::class, 'work_order_item_id');
    }

    public function isActive(): bool
    {
        return $this->warranty_end_at && $this->warranty_end_at->isFuture();
    }

    public function isExpired(): bool
    {
        return $this->warranty_end_at && $this->warranty_end_at->isPast();
    }
}
