<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\Auditable;

class CrmDeal extends Model
{
    use BelongsToTenant, SoftDeletes, HasFactory, Auditable;

    protected $fillable = [
        'tenant_id', 'customer_id', 'pipeline_id', 'stage_id',
        'title', 'value', 'probability', 'expected_close_date',
        'source', 'assigned_to', 'quote_id', 'work_order_id',
        'equipment_id', 'status', 'won_at', 'lost_at',
        'lost_reason', 'loss_reason_id', 'competitor_name', 'competitor_price', 'notes',
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

    public const STATUS_OPEN = 'open';
    public const STATUS_WON = 'won';
    public const STATUS_LOST = 'lost';

    public const STATUSES = [
        self::STATUS_OPEN => ['label' => 'Aberto', 'color' => 'info'],
        self::STATUS_WON => ['label' => 'Ganho', 'color' => 'success'],
        self::STATUS_LOST => ['label' => 'Perdido', 'color' => 'danger'],
    ];

    public const SOURCES = [
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
        return $q->where('status', self::STATUS_OPEN);
    }

    public function scopeWon($q)
    {
        return $q->where('status', self::STATUS_WON);
    }

    public function scopeLost($q)
    {
        return $q->where('status', self::STATUS_LOST);
    }

    public function scopeByPipeline($q, int $pipelineId)
    {
        return $q->where('pipeline_id', $pipelineId);
    }

    // ─── Methods ────────────────────────────────────────

    public function markAsWon(): void
    {
        if ($this->status === self::STATUS_WON) {
            return;
        }

        $wonStage = $this->pipeline->stages()->wonStage()->first();

        $this->update([
            'status' => self::STATUS_WON,
            'probability' => 100,
            'won_at' => now(),
            'stage_id' => $wonStage?->id ?? $this->stage_id,
        ]);
    }

    public function markAsLost(?string $reason = null): void
    {
        if ($this->status === self::STATUS_LOST) {
            return;
        }

        $lostStage = $this->pipeline->stages()->lostStage()->first();

        $this->update([
            'status' => self::STATUS_LOST,
            'probability' => 0,
            'lost_at' => now(),
            'lost_reason' => $reason,
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
