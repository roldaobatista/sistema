<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InmetroBaseConfig extends Model
{
    protected $fillable = [
        'tenant_id',
        'base_lat',
        'base_lng',
        'base_address',
        'base_city',
        'base_state',
        'max_distance_km',
        'enrichment_sources',
        'last_enrichment_at',
    ];

    protected $casts = [
        'base_lat' => 'decimal:7',
        'base_lng' => 'decimal:7',
        'max_distance_km' => 'integer',
        'enrichment_sources' => 'array',
        'last_enrichment_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
