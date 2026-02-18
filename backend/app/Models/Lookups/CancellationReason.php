<?php

namespace App\Models\Lookups;

class CancellationReason extends BaseLookup
{
    protected $table = 'cancellation_reasons';

    protected $fillable = [
        'tenant_id',
        'name',
        'slug',
        'description',
        'color',
        'icon',
        'is_active',
        'sort_order',
        'applies_to',
    ];

    protected function casts(): array
    {
        return array_merge(parent::casts(), [
            'applies_to' => 'array',
        ]);
    }
}
