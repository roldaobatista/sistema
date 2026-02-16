<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GamificationScore extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'user_id', 'period', 'period_type',
        'visits_count', 'deals_won', 'deals_value', 'new_clients',
        'activities_count', 'coverage_percent', 'csat_avg',
        'commitments_on_time', 'commitments_total',
        'total_points', 'rank_position',
    ];

    protected function casts(): array
    {
        return [
            'deals_value' => 'decimal:2',
            'coverage_percent' => 'float',
            'csat_avg' => 'float',
        ];
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }

    public function scopeMonthly($q) { return $q->where('period_type', 'monthly'); }
    public function scopeCurrentPeriod($q, string $type = 'monthly')
    {
        $period = $type === 'monthly' ? now()->format('Y-m') : now()->format('Y-\\WW');
        return $q->where('period_type', $type)->where('period', $period);
    }
}
