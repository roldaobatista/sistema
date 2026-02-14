<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use App\Models\Concerns\BelongsToTenant;

class CorrectiveAction extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'type', 'source', 'sourceable_type', 'sourceable_id',
        'nonconformity_description', 'root_cause', 'action_plan',
        'responsible_id', 'deadline', 'completed_at', 'status', 'verification_notes',
    ];

    protected $casts = [
        'deadline' => 'date',
        'completed_at' => 'date',
    ];

    public function sourceable(): MorphTo
    {
        return $this->morphTo();
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_id');
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->deadline && $this->deadline->isPast() && $this->status !== 'completed' && $this->status !== 'verified';
    }
}
