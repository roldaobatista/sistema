<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class WebhookConfig extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'url', 'events', 'secret',
        'is_active', 'last_triggered_at', 'failure_count',
    ];

    protected $casts = [
        'events' => 'array',
        'is_active' => 'boolean',
        'last_triggered_at' => 'datetime',
        'failure_count' => 'integer',
    ];

    protected $hidden = ['secret'];
}
