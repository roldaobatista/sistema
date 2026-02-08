<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CrmDeal extends Model
{
    use BelongsToTenant, SoftDeletes, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'pipeline_id', 'stage_id',
        'title', 'value', 'probability', 'expected_close_date',
        'source', 'assigned_to', 'quote_id', 'work_order_id',
        'equipment_id', 'status', 'won_at', 'lost_at',
        'lost_reason', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'expected_close_date' => 'date',
            'won_at' => 'datetime',
            'lost_at' => 'datetime',
        ];
    }

    const STATUSES = [
        'open' => ['label' => 'Aberto', 'color' => 'info'],
        'won' => ['label' => 'Ganho', 'color' => 'success'],
        'lost' => ['label' => 'Perdido', 'color' => 'danger'],
    ];

    const SOURCES = [
        'calibracao_vencendo' => 'Calibração Vencendo',
        'indicacao' => 'Indicação',
        'prospeccao' => 'Prospecção',
        'chamado' => 'Chamado Técnico',
        'contrato_renovacao' => 'Renovação de Contrato',
        'retorno' => 'Retorno de Cliente',
        'outro' => 'Outro',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopeOpen($q)
    {
        return $q->where('status', 'open');
    }

    public function scopeWon($q)
    {
        return $q->where('status', 'won');
    }

    public function scopeLost($q)
    {
        return $q->where('status', 'lost');
    }

    public function scopeByPipeline($q, int $pipelineId)
    {
        return $q->where('pipeline_id', $pipelineId);
    }

    // ─── Methods ────────────────────────────────────────

    public function markAsWon(): void
    {
        $wonStage = $this->pipeline->stages()->wonStage()->first();
        $this->update([
            'status' => 'won',
            'won_at' => now(),
            'probability' => 100,
            'stage_id' => $wonStage?->id ?? $this->stage_id,
        ]);
    }

    public function markAsLost(string $reason = ''): void
    {
        $lostStage = $this->pipeline->stages()->lostStage()->first();
        $this->update([
            'status' => 'lost',
            'lost_at' => now(),
            'lost_reason' => $reason,
            'probability' => 0,
            'stage_id' => $lostStage?->id ?? $this->stage_id,
        ]);
    }

    public function moveToStage(int $stageId): void
    {
        $stage = CrmPipelineStage::findOrFail($stageId);
        $this->update([
            'stage_id' => $stageId,
            'probability' => $stage->probability,
        ]);
    }

    // ─── Relationships ──────────────────────────────────

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(CrmPipeline::class, 'pipeline_id');
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(CrmPipelineStage::class, 'stage_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(CrmActivity::class, 'deal_id')->orderByDesc('created_at');
    }
}
