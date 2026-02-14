<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrderChat extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'work_order_id', 'user_id', 'message', 'type', 'file_path', 'read_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
