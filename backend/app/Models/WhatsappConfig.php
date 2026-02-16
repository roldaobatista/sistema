<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class WhatsappConfig extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'provider', 'api_url', 'api_key',
        'instance_name', 'phone_number', 'is_active', 'settings',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'settings' => 'array',
            'api_key' => 'encrypted',
        ];
    }

    protected $hidden = ['api_key'];
}
