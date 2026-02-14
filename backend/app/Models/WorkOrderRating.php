<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrderRating extends Model
{
    protected $fillable = [
        'work_order_id', 'customer_id', 'overall_rating', 'quality_rating',
        'punctuality_rating', 'comment', 'channel',
    ];

    protected $casts = [
        'overall_rating' => 'integer',
        'quality_rating' => 'integer',
        'punctuality_rating' => 'integer',
    ];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
