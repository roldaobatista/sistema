<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\BelongsToTenant;

class OnboardingTemplate extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'type', 'default_tasks', 'is_active',
    ];

    protected $casts = [
        'default_tasks' => 'array',
        'is_active' => 'boolean',
    ];

    public function checklists(): HasMany
    {
        return $this->hasMany(OnboardingChecklist::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
