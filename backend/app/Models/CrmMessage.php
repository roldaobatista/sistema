<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrmMessage extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'deal_id', 'user_id',
        'channel', 'direction', 'status',
        'subject', 'body', 'from_address', 'to_address',
        'external_id', 'provider',
        'attachments', 'metadata',
        'sent_at', 'delivered_at', 'read_at', 'failed_at', 'error_message',
    ];

    protected function casts(): array
    {
        return [
            'attachments' => 'array',
            'metadata' => 'array',
            'sent_at' => 'datetime',
            'delivered_at' => 'datetime',
            'read_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    const CHANNELS = [
        'whatsapp' => 'WhatsApp',
        'email' => 'E-mail',
        'sms' => 'SMS',
    ];

    const DIRECTIONS = [
        'inbound' => 'Recebida',
        'outbound' => 'Enviada',
    ];

    const STATUSES = [
        'pending' => 'Pendente',
        'sent' => 'Enviada',
        'delivered' => 'Entregue',
        'read' => 'Lida',
        'failed' => 'Falhou',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopeByChannel($q, string $channel)
    {
        return $q->where('channel', $channel);
    }

    public function scopeInbound($q)
    {
        return $q->where('direction', 'inbound');
    }

    public function scopeOutbound($q)
    {
        return $q->where('direction', 'outbound');
    }

    public function scopeFailed($q)
    {
        return $q->where('status', 'failed');
    }

    // ─── Methods ────────────────────────────────────────

    public function markSent(string $externalId = null): void
    {
        $data = ['status' => 'sent', 'sent_at' => now()];
        if ($externalId) $data['external_id'] = $externalId;
        $this->update($data);
    }

    public function markDelivered(): void
    {
        $this->update(['status' => 'delivered', 'delivered_at' => now()]);
    }

    public function markRead(): void
    {
        $this->update(['status' => 'read', 'read_at' => now()]);
    }

    public function markFailed(string $error): void
    {
        $this->update(['status' => 'failed', 'failed_at' => now(), 'error_message' => $error]);
    }

    public function logToTimeline(): CrmActivity
    {
        $icon = match ($this->channel) {
            'whatsapp' => '📱',
            'email' => '📧',
            'sms' => '💬',
        };

        $dir = $this->direction === 'inbound' ? 'recebida' : 'enviada';
        $title = "{$icon} " . ucfirst($this->channel) . " {$dir}";
        if ($this->subject) $title .= ": {$this->subject}";

        return CrmActivity::create([
            'tenant_id' => $this->tenant_id,
            'type' => $this->channel === 'email' ? 'email' : 'whatsapp',
            'customer_id' => $this->customer_id,
            'deal_id' => $this->deal_id,
            'user_id' => $this->user_id ?? 1,
            'title' => $title,
            'description' => mb_substr($this->body, 0, 500),
            'is_automated' => true,
            'completed_at' => now(),
            'channel' => $this->channel === 'email' ? 'email' : 'whatsapp',
            'metadata' => [
                'message_id' => $this->id,
                'external_id' => $this->external_id,
                'direction' => $this->direction,
            ],
        ]);
    }

    // ─── Relationships ──────────────────────────────────

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(CrmDeal::class, 'deal_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
