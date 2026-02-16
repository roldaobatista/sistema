<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrmSalesGoal extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_sales_goals';

    protected $fillable = [
        'tenant_id', 'user_id', 'territory_id', 'period_type',
        'period_start', 'period_end', 'target_revenue', 'target_deals',
        'target_new_customers', 'target_activities', 'achieved_revenue',
        'achieved_deals', 'achieved_new_customers', 'achieved_activities',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'target_revenue' => 'decimal:2',
            'achieved_revenue' => 'decimal:2',
            'target_deals' => 'integer',
            'target_new_customers' => 'integer',
            'target_activities' => 'integer',
            'achieved_deals' => 'integer',
            'achieved_new_customers' => 'integer',
            'achieved_activities' => 'integer',
        ];
    }

    public const PERIOD_TYPES = [
        'weekly' => 'Semanal',
        'monthly' => 'Mensal',
        'quarterly' => 'Trimestral',
        'yearly' => 'Anual',
    ];

    // ─── Methods ────────────────────────────────────────

    public function revenueProgress(): float
    {
        if ($this->target_revenue <= 0) {
            return 0;
        }

        return round(($this->achieved_revenue / $this->target_revenue) * 100, 2);
    }

    public function dealsProgress(): float
    {
        if ($this->target_deals <= 0) {
            return 0;
        }

        return round(($this->achieved_deals / $this->target_deals) * 100, 2);
    }

    public function isAchieved(): bool
    {
        return $this->achieved_revenue >= $this->target_revenue
            && $this->achieved_deals >= $this->target_deals;
    }

    // ─── Relationships ──────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function territory(): BelongsTo
    {
        return $this->belongsTo(CrmTerritory::class, 'territory_id');
    }
}
