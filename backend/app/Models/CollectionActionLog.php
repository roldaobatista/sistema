<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CollectionActionLog extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'collection_action_logs';

    protected $fillable = [
        'tenant_id', 'receivable_id', 'rule_id',
        'channel', 'status', 'message', 'error',
    ];

    public function receivable(): BelongsTo
    {
        return $this->belongsTo(AccountReceivable::class, 'receivable_id');
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(CollectionRule::class, 'rule_id');
    }
}
