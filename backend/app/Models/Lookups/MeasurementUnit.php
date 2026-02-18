<?php

namespace App\Models\Lookups;

class MeasurementUnit extends BaseLookup
{
    protected $table = 'measurement_units';

    protected $fillable = [
        'tenant_id',
        'name',
        'slug',
        'description',
        'color',
        'icon',
        'abbreviation',
        'unit_type',
        'is_active',
        'sort_order',
    ];
}
