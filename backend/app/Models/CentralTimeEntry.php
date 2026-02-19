<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CentralTimeEntry extends Model
{
    protected $fillable = [
        'tenant_id',
        'central_item_id',
        'user_id',
        'started_at',
        'stopped_at',
        'duration_seconds',
        'descricao',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'stopped_at' => 'datetime',
        'duration_seconds' => 'integer',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(CentralItem::class, 'central_item_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
