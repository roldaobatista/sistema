<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebhookLog extends Model
{
    protected $fillable = [
        'webhook_id', 'event', 'payload', 'response_status',
        'response_body', 'duration_ms', 'status',
    ];

    protected $casts = [
        'payload' => 'array',
        'response_status' => 'integer',
        'duration_ms' => 'integer',
    ];

    public function webhook(): BelongsTo
    {
        return $this->belongsTo(Webhook::class);
    }
}
