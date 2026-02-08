<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Customer extends Model
{
    use BelongsToTenant, SoftDeletes, HasFactory, Auditable;

    protected $fillable = [
        'tenant_id', 'type', 'name', 'document', 'email',
        'phone', 'phone2', 'notes', 'is_active',
        'address_zip', 'address_street', 'address_number',
        'address_complement', 'address_neighborhood',
        'address_city', 'address_state',
        // CRM fields
        'source', 'segment', 'company_size', 'annual_revenue_estimate',
        'contract_type', 'contract_start', 'contract_end', 'health_score',
        'last_contact_at', 'next_follow_up_at', 'assigned_seller_id',
        'tags', 'rating',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'annual_revenue_estimate' => 'decimal:2',
            'contract_start' => 'date',
            'contract_end' => 'date',
            'last_contact_at' => 'datetime',
            'next_follow_up_at' => 'datetime',
            'tags' => 'array',
        ];
    }

    const SOURCES = [
        'indicacao' => 'Indicação',
        'google' => 'Google',
        'instagram' => 'Instagram',
        'feira' => 'Feira',
        'presenca_fisica' => 'Presença Física',
        'outro' => 'Outro',
    ];

    const SEGMENTS = [
        'supermercado' => 'Supermercado',
        'farmacia' => 'Farmácia',
        'industria' => 'Indústria',
        'padaria' => 'Padaria',
        'laboratorio' => 'Laboratório',
        'frigorifico' => 'Frigorífico',
        'restaurante' => 'Restaurante',
        'hospital' => 'Hospital',
        'agronegocio' => 'Agronegócio',
        'outro' => 'Outro',
    ];

    const COMPANY_SIZES = [
        'micro' => 'Microempresa',
        'pequena' => 'Pequena',
        'media' => 'Média',
        'grande' => 'Grande',
    ];

    const CONTRACT_TYPES = [
        'avulso' => 'Avulso',
        'contrato_mensal' => 'Contrato Mensal',
        'contrato_anual' => 'Contrato Anual',
    ];

    const RATINGS = [
        'A' => 'A — Alto Potencial',
        'B' => 'B — Médio Potencial',
        'C' => 'C — Baixo Potencial',
        'D' => 'D — Inativo',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopeNeedsFollowUp($q)
    {
        return $q->whereNotNull('next_follow_up_at')
            ->where('next_follow_up_at', '<=', now());
    }

    public function scopeNoContactSince($q, int $days = 90)
    {
        return $q->where(function ($q) use ($days) {
            $q->whereNull('last_contact_at')
                ->orWhere('last_contact_at', '<', now()->subDays($days));
        });
    }

    public function scopeBySegment($q, string $segment)
    {
        return $q->where('segment', $segment);
    }

    public function scopeByRating($q, string $rating)
    {
        return $q->where('rating', $rating);
    }

    // ─── Health Score ───────────────────────────────────

    public function getHealthScoreBreakdownAttribute(): array
    {
        $scores = [];

        // Calibrações em dia (0-30)
        $equipments = $this->equipments()->active()->get();
        if ($equipments->isEmpty()) {
            $scores['calibracoes'] = ['score' => 30, 'max' => 30, 'label' => 'Calibrações em dia'];
        } else {
            $total = $equipments->count();
            $emDia = $equipments->filter(fn($e) => $e->calibration_status !== 'vencida')->count();
            $scores['calibracoes'] = [
                'score' => $total > 0 ? round(($emDia / $total) * 30) : 0,
                'max' => 30,
                'label' => 'Calibrações em dia',
            ];
        }

        // OS nos últimos 12 meses (0-20)
        $osRecente = $this->workOrders()
            ->where('created_at', '>=', now()->subMonths(12))
            ->exists();
        $scores['os_recente'] = [
            'score' => $osRecente ? 20 : 0,
            'max' => 20,
            'label' => 'OS nos últimos 12 meses',
        ];

        // Último contato < 90 dias (0-15)
        $contatoRecente = $this->last_contact_at && $this->last_contact_at->diffInDays(now()) < 90;
        $scores['contato_recente'] = [
            'score' => $contatoRecente ? 15 : 0,
            'max' => 15,
            'label' => 'Contato recente (< 90d)',
        ];

        // Orçamento aprovado recente (0-15)
        $orcAprovado = $this->quotes()
            ->where('status', 'approved')
            ->where('approved_at', '>=', now()->subMonths(6))
            ->exists();
        $scores['orcamento_aprovado'] = [
            'score' => $orcAprovado ? 15 : 0,
            'max' => 15,
            'label' => 'Orçamento aprovado (< 6m)',
        ];

        // Sem pendências (0-10)
        $temPendencia = $this->accountsReceivable()
            ->where('status', 'overdue')
            ->exists();
        $scores['sem_pendencia'] = [
            'score' => $temPendencia ? 0 : 10,
            'max' => 10,
            'label' => 'Sem pendências financeiras',
        ];

        // Volume de equipamentos (0-10)
        $eqCount = $equipments->count();
        $scores['volume_equipamentos'] = [
            'score' => min(10, $eqCount * 2),
            'max' => 10,
            'label' => 'Volume de equipamentos',
        ];

        return $scores;
    }

    public function recalculateHealthScore(): int
    {
        $breakdown = $this->health_score_breakdown;
        $total = collect($breakdown)->sum('score');
        $this->update(['health_score' => $total]);
        return $total;
    }

    // ─── Relationships ──────────────────────────────────

    public function contacts(): HasMany
    {
        return $this->hasMany(CustomerContact::class);
    }

    public function deals(): HasMany
    {
        return $this->hasMany(CrmDeal::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(CrmActivity::class)->orderByDesc('created_at');
    }

    public function assignedSeller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_seller_id');
    }

    public function equipments(): HasMany
    {
        return $this->hasMany(Equipment::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class);
    }

    public function serviceCalls(): HasMany
    {
        return $this->hasMany(ServiceCall::class);
    }

    public function accountsReceivable(): HasMany
    {
        return $this->hasMany(AccountReceivable::class);
    }
}
