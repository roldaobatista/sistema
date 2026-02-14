<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use App\Models\Concerns\BelongsToTenant;

class FollowUp extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'followable_type', 'followable_id', 'assigned_to',
        'scheduled_at', 'completed_at', 'channel', 'notes', 'result', 'status',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function followable(): MorphTo
    {
        return $this->morphTo();
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->status === 'pending' && $this->scheduled_at->isPast();
    }
}
