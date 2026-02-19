<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ServiceCallTemplate extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'priority', 'observations',
        'equipment_ids', 'is_active',
    ];

    protected $casts = [
        'equipment_ids' => 'array',
        'is_active' => 'boolean',
    ];
}
