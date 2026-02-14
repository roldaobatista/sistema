<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompetitorInstrumentRepair extends Model
{
    protected $fillable = [
        'competitor_id', 'instrument_id', 'repair_date',
        'seal_number', 'notes', 'source',
    ];

    protected function casts(): array
    {
        return [
            'repair_date' => 'date',
        ];
    }

    public function competitor(): BelongsTo
    {
        return $this->belongsTo(InmetroCompetitor::class, 'competitor_id');
    }

    public function instrument(): BelongsTo
    {
        return $this->belongsTo(InmetroInstrument::class, 'instrument_id');
    }
}
