<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class GamificationBadge extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'name', 'slug', 'description', 'icon', 'color',
        'category', 'metric', 'threshold', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    const CATEGORIES = [
        'visits' => 'Visitas',
        'deals' => 'Negócios',
        'coverage' => 'Cobertura',
        'satisfaction' => 'Satisfação',
        'commitments' => 'Compromissos',
    ];

    public function scopeActive($q) { return $q->where('is_active', true); }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'gamification_user_badges', 'badge_id', 'user_id')
            ->withPivot('earned_at')
            ->withTimestamps();
    }
}
