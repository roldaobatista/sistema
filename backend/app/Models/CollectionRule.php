<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class CollectionRule extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'collection_rules';

    protected $fillable = [
        'tenant_id', 'name', 'days_offset', 'channel',
        'template_type', 'template_id', 'message_body',
        'is_active', 'sort_order',
    ];

    public const CHANNELS = ['whatsapp', 'email', 'sms', 'phone'];

    public const TEMPLATE_TYPES = [
        'reminder' => 'Lembrete',
        'warning' => 'Aviso',
        'final_notice' => 'Notificação Final',
        'legal' => 'Jurídico',
    ];

    protected function casts(): array
    {
        return [
            'days_offset' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
