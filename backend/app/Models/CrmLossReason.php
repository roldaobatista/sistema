<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\Auditable;

class CrmLossReason extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_loss_reasons';

    protected $fillable = [
        'tenant_id', 'name', 'category', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public const CATEGORIES = [
        'price' => 'Preço',
        'competitor' => 'Concorrente',
        'timing' => 'Timing',
        'product_fit' => 'Adequação do Produto',
        'relationship' => 'Relacionamento',
        'budget' => 'Orçamento',
        'other' => 'Outro',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
