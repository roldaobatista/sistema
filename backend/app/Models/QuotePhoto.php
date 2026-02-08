<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class QuotePhoto extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'quote_equipment_id', 'quote_item_id', 'path', 'caption', 'sort_order',
    ];

    public function quoteEquipment(): BelongsTo
    {
        return $this->belongsTo(QuoteEquipment::class);
    }

    public function quoteItem(): BelongsTo
    {
        return $this->belongsTo(QuoteItem::class);
    }
}
