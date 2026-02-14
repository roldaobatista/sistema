<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class CollectionAction extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'account_receivable_id', 'collection_rule_id',
        'step_index', 'channel', 'status', 'scheduled_at', 'sent_at', 'response',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'sent_at' => 'datetime',
        'step_index' => 'integer',
    ];

    public function accountReceivable(): BelongsTo
    {
        return $this->belongsTo(AccountReceivable::class);
    }

    public function collectionRule(): BelongsTo
    {
        return $this->belongsTo(CollectionRule::class);
    }
}
