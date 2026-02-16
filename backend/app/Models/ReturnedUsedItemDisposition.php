<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnedUsedItemDisposition extends Model
{
    protected $fillable = [
        'used_stock_item_id',
        'sent_for_repair',
        'repair_provider_id',
        'repair_provider_name',
        'repair_sent_at',
        'repair_returned_at',
        'will_discard',
        'discarded_at',
        'disposition_notes',
        'registered_by',
    ];

    protected function casts(): array
    {
        return [
            'sent_for_repair' => 'boolean',
            'will_discard' => 'boolean',
            'repair_sent_at' => 'datetime',
            'repair_returned_at' => 'datetime',
            'discarded_at' => 'datetime',
        ];
    }

    public function usedStockItem(): BelongsTo
    {
        return $this->belongsTo(UsedStockItem::class, 'used_stock_item_id');
    }

    public function repairProvider(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'repair_provider_id');
    }
}
