<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Camera extends Model
{
    protected $fillable = [
        'name',
        'stream_url',
        'is_active',
        'position'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'position' => 'integer',
    ];
}
