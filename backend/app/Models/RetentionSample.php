<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetentionSample extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'work_order_id', 'sample_code',
        'description', 'location', 'retention_until',
        'status', 'disposed_at', 'notes',
    ];

    protected $casts = [
        'retention_until' => 'date',
        'disposed_at' => 'datetime',
    ];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }
}
