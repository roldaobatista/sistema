<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TwoFactorAuth extends Model
{
    protected $table = 'user_2fa';

    protected $fillable = [
        'user_id', 'secret', 'is_enabled', 'verified_at',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'verified_at' => 'datetime',
    ];

    protected $hidden = ['secret'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
