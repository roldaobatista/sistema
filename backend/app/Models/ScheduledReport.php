<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class ScheduledReport extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'report_type', 'frequency', 'recipients',
        'filters', 'format', 'is_active', 'last_sent_at', 'next_send_at', 'created_by',
    ];

    protected $casts = [
        'recipients' => 'array',
        'filters' => 'array',
        'is_active' => 'boolean',
        'last_sent_at' => 'date',
        'next_send_at' => 'date',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
