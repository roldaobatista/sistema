<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SystemAlert extends Model
{
    use BelongsToTenant;

    public const TYPES = [
        'unbilled_wo' => 'OS concluída sem faturamento',
        'expiring_contract' => 'Contrato recorrente vencendo',
        'expiring_calibration' => 'Calibração de equipamento vencendo',
        'calibration_overdue' => 'Calibração de equipamento vencida',
        'tool_cal_overdue' => 'Ferramenta com calibração vencida',
        'expense_pending' => 'Despesa pendente de aprovação',
        'sla_breach' => 'SLA estourado',
        'weight_cert_expiring' => 'Certificado de peso padrão vencendo',
        'quote_expiring' => 'Orçamento próximo da validade',
        'quote_expired' => 'Orçamento já expirado',
        'tool_cal_expiring' => 'Ferramenta com calibração vencendo',
        'overdue_receivable' => 'Conta a receber em atraso',
        'low_stock' => 'Estoque abaixo do mínimo',
        'overdue_payable' => 'Conta a pagar em atraso',
        'expiring_payable' => 'Conta a pagar vencendo',
        'expiring_fleet_insurance' => 'Seguro de frota vencendo',
        'expiring_supplier_contract' => 'Contrato de fornecedor vencendo',
        'commitment_overdue' => 'Compromisso CRM atrasado',
        'important_date_upcoming' => 'Data importante próxima',
        'customer_no_contact' => 'Cliente sem contato há X dias',
        'overdue_follow_up' => 'Follow-up em atraso',
        'unattended_service_call' => 'Chamado aberto há muito tempo',
        'renegotiation_pending' => 'Renegociação pendente de aprovação',
        'receivables_concentration' => 'Concentração de inadimplência',
        'scheduled_wo_not_started' => 'OS agendada/recebida sem início',
    ];

    protected $fillable = [
        'tenant_id', 'alert_type', 'severity', 'title', 'message',
        'alertable_type', 'alertable_id', 'channels_sent', 'status',
        'acknowledged_by', 'acknowledged_at', 'resolved_at', 'escalated_at',
    ];

    protected function casts(): array
    {
        return [
            'channels_sent' => 'array',
            'acknowledged_at' => 'datetime',
            'resolved_at' => 'datetime',
            'escalated_at' => 'datetime',
        ];
    }

    public function alertable(): MorphTo { return $this->morphTo(); }
    public function acknowledgedBy(): BelongsTo { return $this->belongsTo(User::class, 'acknowledged_by'); }

    public function scopeActive($q) { return $q->where('status', 'active'); }
    public function scopeByType($q, string $type) { return $q->where('alert_type', $type); }
}
