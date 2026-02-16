<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class WhatsappMessageLog extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'direction', 'phone_to', 'phone_from', 'message',
        'message_type', 'template_name', 'template_params', 'status',
        'external_id', 'error_message', 'related_type', 'related_id',
        'sent_at', 'delivered_at', 'read_at',
    ];

    protected function casts(): array
    {
        return [
            'template_params' => 'array',
            'sent_at' => 'datetime',
            'delivered_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    public function related(): MorphTo
    {
        return $this->morphTo();
    }
}
