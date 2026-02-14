<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SsoConfig extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'provider', 'client_id', 'client_secret',
        'redirect_url', 'is_enabled', 'auto_create_users',
        'default_role',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'auto_create_users' => 'boolean',
    ];

    protected $hidden = ['client_secret'];
}
