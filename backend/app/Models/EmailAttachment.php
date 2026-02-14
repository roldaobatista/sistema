<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailAttachment extends Model
{
    protected $guarded = ['id'];

    protected $casts = [
        'size_bytes' => 'integer',
    ];

    public function email(): BelongsTo
    {
        return $this->belongsTo(Email::class);
    }

    public function getSizeFormattedAttribute(): string
    {
        $bytes = $this->size_bytes;
        if ($bytes < 1024) return $bytes . ' B';
        if ($bytes < 1048576) return round($bytes / 1024, 1) . ' KB';
        return round($bytes / 1048576, 1) . ' MB';
    }
}
