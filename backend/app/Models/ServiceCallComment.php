<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceCallComment extends Model
{
    protected $fillable = [
        'service_call_id',
        'user_id',
        'content',
    ];

    public function serviceCall(): BelongsTo
    {
        return $this->belongsTo(ServiceCall::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
