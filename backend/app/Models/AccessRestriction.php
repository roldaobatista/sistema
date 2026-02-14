<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class AccessRestriction extends Model
{
    use BelongsToTenant;

    protected $table = 'access_time_restrictions';

    protected $fillable = [
        'tenant_id', 'role_name', 'allowed_days',
        'start_time', 'end_time', 'is_active',
    ];

    protected $casts = [
        'allowed_days' => 'array',
        'is_active' => 'boolean',
    ];
}
