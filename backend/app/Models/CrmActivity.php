<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

class CrmActivity extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'type', 'customer_id', 'deal_id', 'user_id',
        'title', 'description', 'scheduled_at', 'completed_at',
        'duration_minutes', 'outcome', 'is_automated', 'channel',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'completed_at' => 'datetime',
            'is_automated' => 'boolean',
            'metadata' => 'array',
        ];
    }

    const TYPES = [
        'ligacao' => ['label' => 'Ligação', 'icon' => 'phone'],
        'email' => ['label' => 'E-mail', 'icon' => 'mail'],
        'reuniao' => ['label' => 'Reunião', 'icon' => 'users'],
        'visita' => ['label' => 'Visita', 'icon' => 'map-pin'],
        'whatsapp' => ['label' => 'WhatsApp', 'icon' => 'message-circle'],
        'nota' => ['label' => 'Nota', 'icon' => 'file-text'],
        'tarefa' => ['label' => 'Tarefa', 'icon' => 'check-square'],
        'system' => ['label' => 'Sistema', 'icon' => 'cpu'],
    ];

    const OUTCOMES = [
        'conectou' => 'Conectou',
        'nao_atendeu' => 'Não Atendeu',
        'reagendar' => 'Reagendar',
        'sucesso' => 'Sucesso',
        'sem_interesse' => 'Sem Interesse',
    ];

    const CHANNELS = [
        'whatsapp' => 'WhatsApp',
        'email' => 'E-mail',
        'telefone' => 'Telefone',
        'presencial' => 'Presencial',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopePending($q)
    {
        return $q->whereNull('completed_at')->whereNotNull('scheduled_at');
    }

    public function scopeCompleted($q)
    {
        return $q->whereNotNull('completed_at');
    }

    public function scopeByType($q, string $type)
    {
        return $q->where('type', $type);
    }

    public function scopeUpcoming($q)
    {
        return $q->whereNull('completed_at')
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '>=', now())
            ->orderBy('scheduled_at');
    }

    // ─── Factory Methods ────────────────────────────────

    public static function logSystemEvent(
        int $tenantId,
        int $customerId,
        string $title,
        ?int $dealId = null,
        ?int $userId = null,
        ?array $metadata = null
    ): static {
        return static::create([
            'tenant_id' => $tenantId,
            'type' => 'system',
            'customer_id' => $customerId,
            'deal_id' => $dealId,
            'user_id' => $userId ?? (Auth::check() ? Auth::id() : null),
            'title' => $title,
            'is_automated' => true,
            'completed_at' => now(),
            'metadata' => $metadata,
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
