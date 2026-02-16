<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\Auditable;

class CrmLeadScoringRule extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_lead_scoring_rules';

    protected $fillable = [
        'tenant_id', 'name', 'field', 'operator', 'value',
        'points', 'category', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'points' => 'integer',
        ];
    }

    public const CATEGORIES = [
        'demographic' => 'Demográfico',
        'behavioral' => 'Comportamental',
        'engagement' => 'Engajamento',
        'firmographic' => 'Firmográfico',
    ];

    public const OPERATORS = [
        'equals', 'not_equals', 'greater_than', 'less_than',
        'contains', 'in', 'not_in', 'between',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
