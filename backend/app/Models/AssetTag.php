<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetTag extends Model
{
    protected $fillable = [
        'tenant_id', 'tag_code', 'tag_type', 'taggable_type', 'taggable_id',
        'status', 'location', 'last_scanned_at', 'last_scanned_by', 'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'last_scanned_at' => 'datetime',
    ];

    public function taggable(): MorphTo
    {
        return $this->morphTo();
    }

    public function scans(): HasMany
    {
        return $this->hasMany(AssetTagScan::class);
    }

    public function lastScanner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_scanned_by');
    }
}
