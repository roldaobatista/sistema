<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrmDealCompetitor extends Model
{
    protected $table = 'crm_deal_competitors';

    protected $fillable = [
        'deal_id', 'competitor_name', 'competitor_price',
        'strengths', 'weaknesses', 'outcome',
    ];

    protected function casts(): array
    {
        return [
            'competitor_price' => 'decimal:2',
        ];
    }

    public const OUTCOMES = [
        'won' => 'Vencemos',
        'lost' => 'Perdemos',
        'unknown' => 'Desconhecido',
    ];

    // ─── Relationships ──────────────────────────────────

    public function deal(): BelongsTo
    {
        return $this->belongsTo(CrmDeal::class, 'deal_id');
    }
}
