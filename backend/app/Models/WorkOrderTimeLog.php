<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkOrderTimeLog extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'work_order_id',
        'user_id',
        'started_at',
        'ended_at',
        'duration_seconds',
        'activity_type',
        'description',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'duration_seconds' => 'integer',
    ];

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
