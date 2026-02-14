<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InmetroCompetitorSnapshot extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'competitor_id', 'snapshot_type', 'period_start',
        'period_end', 'instrument_count', 'repair_count', 'new_instruments',
        'lost_instruments', 'market_share_pct', 'by_city', 'by_type',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'market_share_pct' => 'decimal:2',
            'by_city' => 'array',
            'by_type' => 'array',
        ];
    }

    public function competitor(): BelongsTo
    {
        return $this->belongsTo(InmetroCompetitor::class, 'competitor_id');
    }
}
