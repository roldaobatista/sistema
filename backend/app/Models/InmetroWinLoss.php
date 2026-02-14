<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo; // Existing imports preserved

class InmetroWinLoss extends Model
{
    use HasFactory, BelongsToTenant;

    protected $table = 'inmetro_win_loss';

    protected $fillable = [
        'tenant_id', 'owner_id', 'competitor_id', 'outcome',
        'reason', 'estimated_value', 'notes', 'outcome_date',
    ];

    protected function casts(): array
    {
        return [
            'estimated_value' => 'decimal:2',
            'outcome_date' => 'date',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(InmetroOwner::class, 'owner_id');
    }

    public function competitor(): BelongsTo
    {
        return $this->belongsTo(InmetroCompetitor::class, 'competitor_id');
    }

    public function scopeWins($query)
    {
        return $query->where('outcome', 'win');
    }

    public function scopeLosses($query)
    {
        return $query->where('outcome', 'loss');
    }
}
