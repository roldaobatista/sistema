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
        'expense_pending' => 'Despesa pendente de aprovação',
        'sla_breach' => 'SLA estourado',
        'weight_cert_expiring' => 'Certificado de peso padrão vencendo',
        'quote_expiring' => 'Orçamento próximo da validade',
        'tool_cal_expiring' => 'Ferramenta com calibração vencendo',
        'overdue_receivable' => 'Conta a receber em atraso',
        'low_stock' => 'Estoque abaixo do mínimo',
    ];

    protected $fillable = [
        'tenant_id', 'alert_type', 'severity', 'title', 'message',
        'alertable_type', 'alertable_id', 'channels_sent', 'status',
        'acknowledged_by', 'acknowledged_at', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'channels_sent' => 'array',
            'acknowledged_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function alertable(): MorphTo { return $this->morphTo(); }
    public function acknowledgedBy(): BelongsTo { return $this->belongsTo(User::class, 'acknowledged_by'); }

    public function scopeActive($q) { return $q->where('status', 'active'); }
    public function scopeByType($q, string $type) { return $q->where('alert_type', $type); }
}
