<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InmetroLeadScore extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'owner_id', 'tenant_id', 'total_score', 'expiration_score',
        'value_score', 'contact_score', 'region_score', 'instrument_score',
        'factors', 'calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'factors' => 'array',
            'calculated_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(InmetroOwner::class, 'owner_id');
    }
}
