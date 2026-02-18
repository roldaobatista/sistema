<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FiscalWebhook extends Model
{
    protected $fillable = [
        'tenant_id', 'url', 'events', 'secret', 'active',
        'failure_count', 'last_triggered_at',
    ];

    protected $attributes = [
        'events' => '["authorized","cancelled","rejected"]',
    ];

    protected $casts = [
        'events' => 'array',
        'active' => 'boolean',
        'last_triggered_at' => 'datetime',
    ];

    protected $hidden = ['secret'];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
