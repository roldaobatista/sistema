<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OnboardingChecklistItem extends Model
{
    protected $fillable = [
        'onboarding_checklist_id', 'title', 'description',
        'responsible_id', 'is_completed', 'completed_at',
        'completed_by', 'order',
    ];

    protected $casts = [
        'is_completed' => 'boolean',
        'completed_at' => 'datetime',
        'order' => 'integer',
    ];

    public function checklist(): BelongsTo
    {
        return $this->belongsTo(OnboardingChecklist::class, 'onboarding_checklist_id');
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_id');
    }

    public function completedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
