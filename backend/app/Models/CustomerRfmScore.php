<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRfmScore extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'recency_score', 'frequency_score',
        'monetary_score', 'rfm_segment', 'total_score',
        'last_purchase_date', 'purchase_count', 'total_revenue', 'calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'last_purchase_date' => 'date',
            'total_revenue' => 'decimal:2',
            'calculated_at' => 'datetime',
        ];
    }

    const SEGMENTS = [
        'champions' => 'Campeões',
        'loyal' => 'Leais',
        'potential_loyal' => 'Potencialmente Leais',
        'new_customers' => 'Novos Clientes',
        'promising' => 'Promissores',
        'needs_attention' => 'Precisa de Atenção',
        'about_to_sleep' => 'Prestes a Dormir',
        'at_risk' => 'Em Risco',
        'cant_lose' => 'Não Pode Perder',
        'hibernating' => 'Hibernando',
        'lost' => 'Perdido',
    ];

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }

    public static function calculateSegment(int $r, int $f, int $m): string
    {
        $total = $r + $f + $m;
        if ($r >= 4 && $f >= 4 && $m >= 4) return 'champions';
        if ($f >= 4 && $m >= 3) return 'loyal';
        if ($r >= 4 && $f >= 2) return 'potential_loyal';
        if ($r >= 4 && $f <= 2) return 'new_customers';
        if ($r >= 3 && $f >= 1 && $m >= 1) return 'promising';
        if ($r == 3 && $f >= 3) return 'needs_attention';
        if ($r == 2 && $f >= 2) return 'about_to_sleep';
        if ($r <= 2 && $f >= 3 && $m >= 3) return 'cant_lose';
        if ($r <= 2 && $f >= 2) return 'at_risk';
        if ($r <= 2 && $f <= 2) return 'hibernating';
        return 'lost';
    }
}
