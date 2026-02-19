<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Notifications\Notifiable;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Customer extends Model
{
    use BelongsToTenant, SoftDeletes, HasFactory, Auditable, Notifiable;

    protected $fillable = [
        'tenant_id', 'type', 'name', 'trade_name', 'document', 'email',
        'phone', 'phone2', 'notes', 'is_active',
        'address_zip', 'address_street', 'address_number',
        'address_complement', 'address_neighborhood',
        'address_city', 'address_state',
        'latitude', 'longitude', 'google_maps_link',
        // Enrichment fields
        'state_registration', 'municipal_registration',
        'cnae_code', 'cnae_description', 'legal_nature',
        'capital', 'simples_nacional', 'mei',
        'company_status', 'opened_at', 'is_rural_producer',
        'partners', 'secondary_activities',
        'enrichment_data', 'enriched_at',
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
            'is_rural_producer' => 'boolean',
            'simples_nacional' => 'boolean',
            'mei' => 'boolean',
            'capital' => 'decimal:2',
            'annual_revenue_estimate' => 'decimal:2',
            'opened_at' => 'date',
            'contract_start' => 'date',
            'contract_end' => 'date',
            'last_contact_at' => 'datetime',
            'next_follow_up_at' => 'datetime',
            'enriched_at' => 'datetime',
            'tags' => 'array',
            'partners' => 'array',
            'secondary_activities' => 'array',
            'enrichment_data' => 'array',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public const SOURCES = [
        'indicacao' => 'Indicação',
        'google' => 'Google',
        'instagram' => 'Instagram',
        'feira' => 'Feira',
        'presenca_fisica' => 'Presença Física',
        'outro' => 'Outro',
    ];

    public const SEGMENTS = [
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

    public const COMPANY_SIZES = [
        'micro' => 'Microempresa',
        'pequena' => 'Pequena',
        'media' => 'Média',
        'grande' => 'Grande',
    ];

    public const CONTRACT_TYPES = [
        'avulso' => 'Avulso',
        'contrato_mensal' => 'Contrato Mensal',
        'contrato_anual' => 'Contrato Anual',
    ];

    public const RATINGS = [
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
            ->where('status', Quote::STATUS_APPROVED)
            ->where('approved_at', '>=', now()->subMonths(6))
            ->exists();
        $scores['orcamento_aprovado'] = [
            'score' => $orcAprovado ? 15 : 0,
            'max' => 15,
            'label' => 'Orçamento aprovado (< 6m)',
        ];

        // Sem pendências (0-10)
        $temPendencia = $this->accountsReceivable()
            ->where('status', AccountReceivable::STATUS_OVERDUE)
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
        $this->updateQuietly(['health_score' => $total]);
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

    /**
     * GAP-26: Computed — próxima calibração mais urgente entre todos os equipamentos do cliente.
     */
    public function getNearestCalibrationAtAttribute(): ?string
    {
        return $this->equipments()
            ->whereNotNull('next_calibration_at')
            ->min('next_calibration_at');
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

    public function documents(): HasMany
    {
        return $this->hasMany(CustomerDocument::class);
    }

    public function complaints(): HasMany
    {
        return $this->hasMany(CustomerComplaint::class);
    }

    public function rfmScores(): HasMany
    {
        return $this->hasMany(CustomerRfmScore::class);
    }

    // ─── Import Support ─────────────────────────────────────

    public static function getImportFields(): array
    {
        return [
            ['key' => 'name', 'label' => 'Nome', 'required' => true],
            ['key' => 'document', 'label' => 'CPF/CNPJ', 'required' => true],
            ['key' => 'type', 'label' => 'Tipo (PF/PJ)', 'required' => false],
            ['key' => 'trade_name', 'label' => 'Nome Fantasia', 'required' => false],
            ['key' => 'email', 'label' => 'E-mail', 'required' => false],
            ['key' => 'phone', 'label' => 'Telefone', 'required' => false],
            ['key' => 'phone2', 'label' => 'Telefone 2', 'required' => false],
            ['key' => 'address_zip', 'label' => 'CEP', 'required' => false],
            ['key' => 'address_street', 'label' => 'Rua', 'required' => false],
            ['key' => 'address_number', 'label' => 'Número', 'required' => false],
            ['key' => 'address_complement', 'label' => 'Complemento', 'required' => false],
            ['key' => 'address_neighborhood', 'label' => 'Bairro', 'required' => false],
            ['key' => 'address_city', 'label' => 'Cidade', 'required' => false],
            ['key' => 'address_state', 'label' => 'UF', 'required' => false],
            ['key' => 'notes', 'label' => 'Observações', 'required' => false],
        ];
    }
}
