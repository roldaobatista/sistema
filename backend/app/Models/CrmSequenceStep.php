<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrmSequenceStep extends Model
{
    protected $table = 'crm_sequence_steps';

    protected $fillable = [
        'sequence_id', 'step_order', 'delay_days', 'channel',
        'action_type', 'template_id', 'subject', 'body', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'delay_days' => 'integer',
            'step_order' => 'integer',
        ];
    }

    public const ACTION_TYPES = [
        'send_message', 'create_activity', 'create_task',
        'update_deal', 'wait',
    ];

    // ─── Relationships ──────────────────────────────────

    public function sequence(): BelongsTo
    {
        return $this->belongsTo(CrmSequence::class, 'sequence_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(CrmMessageTemplate::class, 'template_id');
    }
}
