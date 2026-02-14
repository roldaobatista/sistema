<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InmetroHistory extends Model
{
    protected $table = 'inmetro_history';

    protected $fillable = [
        'instrument_id', 'event_type', 'event_date',
        'result', 'executor', 'competitor_id', 'validity_date', 'notes', 'source',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'validity_date' => 'date',
        ];
    }

    public function instrument(): BelongsTo
    {
        return $this->belongsTo(InmetroInstrument::class, 'instrument_id');
    }

    public function competitor(): BelongsTo
    {
        return $this->belongsTo(InmetroCompetitor::class, 'competitor_id');
    }

    public function getEventTypeLabelAttribute(): string
    {
        return match ($this->event_type) {
            'verification' => 'Verificação Periódica',
            'repair' => 'Reparo',
            'rejection' => 'Reprovação',
            'initial' => 'Verificação Inicial',
            default => $this->event_type,
        };
    }

    public function getResultLabelAttribute(): string
    {
        return match ($this->result) {
            'approved' => 'Aprovado',
            'rejected' => 'Reprovado',
            'repaired' => 'Reparado',
            default => $this->result,
        };
    }
}
