<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CommissionCampaign extends Model
{
    use BelongsToTenant, HasFactory, Auditable;

    protected $fillable = [
        'tenant_id', 'name', 'multiplier',
        'applies_to_role', 'applies_to_calculation_type',
        'starts_at', 'ends_at', 'active',
    ];

    protected function casts(): array
    {
        return [
            'multiplier' => 'decimal:2',
            'starts_at' => 'date',
            'ends_at' => 'date',
            'active' => 'boolean',
        ];
    }

    public function scopeActive($query)
    {
        return $query->where('active', true)
            ->where('starts_at', '<=', now()->toDateString())
            ->where('ends_at', '>=', now()->toDateString());
    }

    public function isCurrentlyActive(): bool
    {
        return $this->active
            && $this->starts_at <= now()
            && $this->ends_at >= now();
    }
}
