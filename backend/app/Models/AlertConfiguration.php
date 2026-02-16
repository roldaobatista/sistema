<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class AlertConfiguration extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'alert_type', 'is_enabled', 'channels',
        'days_before', 'cron_expression', 'recipients',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'channels' => 'array',
            'recipients' => 'array',
        ];
    }
}
