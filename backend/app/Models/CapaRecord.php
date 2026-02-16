<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CapaRecord extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'capa_records';

    protected $fillable = [
        'tenant_id', 'type', 'source', 'source_id', 'title', 'description',
        'root_cause', 'corrective_action', 'preventive_action', 'verification',
        'status', 'assigned_to', 'created_by', 'due_date', 'closed_at', 'effectiveness',
    ];

    public const TYPES = [
        'corrective' => 'Ação Corretiva',
        'preventive' => 'Ação Preventiva',
    ];

    public const STATUSES = [
        'open' => 'Aberto',
        'investigating' => 'Em Investigação',
        'implementing' => 'Em Implementação',
        'verifying' => 'Verificando Eficácia',
        'closed' => 'Fechado',
    ];

    public const SOURCES = [
        'nps_detractor' => 'NPS Detrator',
        'complaint' => 'Reclamação',
        'audit' => 'Auditoria',
        'rework' => 'Retrabalho',
        'manual' => 'Manual',
    ];

    public const EFFECTIVENESS = [
        'effective' => 'Eficaz',
        'partially_effective' => 'Parcialmente Eficaz',
        'not_effective' => 'Não Eficaz',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'closed_at' => 'datetime',
        ];
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', '!=', 'closed');
    }

    public function scopeBySource(Builder $query, string $source): Builder
    {
        return $query->where('source', $source);
    }
}
