<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\Auditable;

class CrmSmartAlert extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'crm_smart_alerts';

    protected $fillable = [
        'tenant_id', 'type', 'priority', 'title', 'description',
        'customer_id', 'deal_id', 'equipment_id', 'assigned_to',
        'status', 'metadata', 'acknowledged_at', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'acknowledged_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public const TYPES = [
        'calibration_expiring' => 'Calibração Vencendo',
        'deal_stalled' => 'Deal Parado',
        'health_dropping' => 'Health Score Caindo',
        'no_contact' => 'Sem Contato',
        'contract_expiring' => 'Contrato Vencendo',
        'opportunity_detected' => 'Oportunidade Detectada',
        'nps_detractor' => 'NPS Detrator',
    ];

    public const PRIORITIES = [
        'critical' => 'Crítica',
        'high' => 'Alta',
        'medium' => 'Média',
        'low' => 'Baixa',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopePending($q)
    {
        return $q->where('status', 'pending');
    }

    public function scopeByType($q, string $type)
    {
        return $q->where('type', $type);
    }

    public function scopeByPriority($q, string $priority)
    {
        return $q->where('priority', $priority);
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

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
