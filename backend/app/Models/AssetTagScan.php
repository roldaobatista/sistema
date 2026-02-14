<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetTagScan extends Model
{
    protected $fillable = [
        'asset_tag_id', 'scanned_by', 'action', 'location', 'latitude', 'longitude', 'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
    ];

    public function tag(): BelongsTo
    {
        return $this->belongsTo(AssetTag::class, 'asset_tag_id');
    }

    public function scanner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scanned_by');
    }
}
