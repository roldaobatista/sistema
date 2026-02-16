<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\Auditable;

class CrmForecastSnapshot extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_forecast_snapshots';

    protected $fillable = [
        'tenant_id', 'snapshot_date', 'period_type', 'period_start',
        'period_end', 'pipeline_value', 'weighted_value', 'best_case',
        'worst_case', 'committed', 'deal_count', 'won_value', 'won_count',
        'by_stage', 'by_user',
    ];

    protected function casts(): array
    {
        return [
            'snapshot_date' => 'date',
            'period_start' => 'date',
            'period_end' => 'date',
            'pipeline_value' => 'decimal:2',
            'weighted_value' => 'decimal:2',
            'best_case' => 'decimal:2',
            'worst_case' => 'decimal:2',
            'committed' => 'decimal:2',
            'won_value' => 'decimal:2',
            'deal_count' => 'integer',
            'won_count' => 'integer',
            'by_stage' => 'array',
            'by_user' => 'array',
        ];
    }

    public const PERIOD_TYPES = [
        'monthly' => 'Mensal',
        'quarterly' => 'Trimestral',
        'yearly' => 'Anual',
    ];
}
