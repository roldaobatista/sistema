<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class WorkOrderStatusHistory extends Model
{
    use BelongsToTenant;

    protected $table = 'work_order_status_history';

    protected $fillable = ['tenant_id', 'work_order_id', 'user_id', 'from_status', 'to_status', 'notes'];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
