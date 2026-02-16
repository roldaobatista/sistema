<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuickNote extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'user_id', 'deal_id',
        'channel', 'sentiment', 'content', 'is_pinned', 'tags',
    ];

    protected function casts(): array
    {
        return [
            'is_pinned' => 'boolean',
            'tags' => 'array',
        ];
    }

    const CHANNELS = [
        'telefone' => 'Telefone',
        'presencial' => 'Presencial',
        'whatsapp' => 'WhatsApp',
        'email' => 'E-mail',
    ];

    const SENTIMENTS = [
        'positive' => 'Positivo',
        'neutral' => 'Neutro',
        'negative' => 'Negativo',
    ];

    public function scopePinned($q) { return $q->where('is_pinned', true); }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function deal(): BelongsTo { return $this->belongsTo(CrmDeal::class, 'deal_id'); }
}
