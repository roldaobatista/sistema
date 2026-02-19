<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CentralSubtask extends Model
{
    protected $fillable = [
        'tenant_id',
        'central_item_id',
        'titulo',
        'concluido',
        'ordem',
        'completed_by',
        'completed_at',
    ];

    protected $casts = [
        'concluido' => 'boolean',
        'ordem' => 'integer',
        'completed_at' => 'datetime',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(CentralItem::class, 'central_item_id');
    }

    public function completedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
