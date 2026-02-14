<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class AutomationRule extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'trigger_event', 'conditions', 'actions',
        'is_active', 'execution_count', 'last_executed_at', 'created_by',
    ];

    protected $casts = [
        'conditions' => 'array',
        'actions' => 'array',
        'is_active' => 'boolean',
        'execution_count' => 'integer',
        'last_executed_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
