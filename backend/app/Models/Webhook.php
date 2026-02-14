<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\BelongsToTenant;

class Webhook extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'url', 'events', 'secret',
        'is_active', 'failure_count', 'last_triggered_at',
    ];

    protected $casts = [
        'events' => 'array',
        'is_active' => 'boolean',
        'failure_count' => 'integer',
        'last_triggered_at' => 'datetime',
    ];

    public function logs(): HasMany
    {
        return $this->hasMany(WebhookLog::class);
    }
}
