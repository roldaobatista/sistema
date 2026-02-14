<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSession extends Model
{
    protected $fillable = [
        'user_id', 'token_id', 'ip_address', 'user_agent',
        'device_type', 'location', 'last_activity_at',
    ];

    protected $casts = [
        'last_activity_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
