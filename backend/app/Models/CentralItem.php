<?php

namespace App\Models;

use App\Enums\CentralItemOrigin;
use App\Enums\CentralItemPriority;
use App\Enums\CentralItemStatus;
use App\Enums\CentralItemType;
use App\Enums\CentralItemVisibility;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Notification;
use BackedEnum;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class CentralItem extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    protected $guarded = ['id'];

    protected $casts = [
        'tipo' => CentralItemType::class,
        'status' => CentralItemStatus::class,
        'prioridade' => CentralItemPriority::class,
        'origem' => CentralItemOrigin::class,
        'visibilidade' => CentralItemVisibility::class,
        'due_at' => 'datetime',
        'remind_at' => 'datetime',
        'remind_notified_at' => 'datetime',
        'snooze_until' => 'datetime',
        'sla_due_at' => 'datetime',
        'closed_at' => 'datetime',
        'contexto' => 'array',
        'tags' => 'array',
    ];

    public function responsavel(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsavel_user_id');
    }

    public function criadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'criado_por_user_id');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(CentralItemComment::class);
    }

    public function history(): HasMany
    {
        return $this->hasMany(CentralItemHistory::class);
    }

    public function source(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'ref_tipo', 'ref_id');
    }

    public function scopeAtrasados(Builder $query): Builder
    {
        return $query->where('status', '!=', CentralItemStatus::CONCLUIDO)
            ->where('status', '!=', CentralItemStatus::CANCELADO)
            ->where('due_at', '<', now());
    }

    public function scopeHoje(Builder $query): Builder
    {
        return $query->where('status', '!=', CentralItemStatus::CONCLUIDO)
            ->where('status', '!=', CentralItemStatus::CANCELADO)
            ->whereDate('due_at', today())
            ->where(fn ($q) => $q->whereNull('snooze_until')->orWhere('snooze_until', '<=', now()));
    }

    public function scopeSemPrazo(Builder $query): Builder
    {
        return $query->where('status', '!=', CentralItemStatus::CONCLUIDO)
            ->where('status', '!=', CentralItemStatus::CANCELADO)
            ->whereNull('due_at');
    }

    public function scopeDoUsuario(Builder $query, int $userId): Builder
    {
        return $query->where('responsavel_user_id', $userId);
    }

    public function scopeDaEquipe(Builder $query, array $userIds): Builder
    {
        return $query->whereIn('responsavel_user_id', $userIds)
            ->orWhere('visibilidade', CentralItemVisibility::EQUIPE)
            ->orWhere('visibilidade', CentralItemVisibility::EMPRESA);
    }

    public static function criarDeOrigem(
        Model $model,
        CentralItemType $tipo,
        string $titulo,
        ?int $responsavelId = null,
        array $extras = []
    ): self {
        $tenantId = $model->tenant_id ?? app('current_tenant_id');
        $authUser = auth()->user();
        $authUserId = $authUser instanceof User ? (int) $authUser->id : null;
        $criadoPorUserId = $extras['criado_por_user_id']
            ?? $authUserId
            ?? $responsavelId
            ?? User::query()->where('tenant_id', $tenantId)->value('id');

        $responsavelId ??= $criadoPorUserId;

        $payload = self::normalizePayload([
            'tenant_id' => $tenantId,
            'tipo' => $tipo,
            'origem' => $extras['origem'] ?? CentralItemOrigin::AUTO,
            'ref_tipo' => $model->getMorphClass(),
            'ref_id' => $model->getKey(),
            'titulo' => $titulo,
            'descricao_curta' => $extras['descricao_curta'] ?? null,
            'responsavel_user_id' => $responsavelId,
            'criado_por_user_id' => $criadoPorUserId,
            'status' => $extras['status'] ?? CentralItemStatus::ABERTO,
            'prioridade' => $extras['prioridade'] ?? CentralItemPriority::MEDIA,
            'visibilidade' => $extras['visibilidade'] ?? CentralItemVisibility::EQUIPE,
            'due_at' => $extras['due_at'] ?? null,
            'remind_at' => $extras['remind_at'] ?? null,
            'snooze_until' => $extras['snooze_until'] ?? null,
            'sla_due_at' => $extras['sla_due_at'] ?? null,
            'closed_at' => $extras['closed_at'] ?? null,
            'closed_by' => $extras['closed_by'] ?? null,
            'contexto' => $extras['contexto'] ?? null,
            'tags' => $extras['tags'] ?? null,
        ]);

        return static::withoutGlobalScopes()->updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'ref_tipo' => $model->getMorphClass(),
                'ref_id' => $model->getKey(),
            ],
            $payload
        );
    }

    public static function syncFromSource(Model $source, array $overrides = []): void
    {
        $tenantId = $source->tenant_id ?? app('current_tenant_id');
        if (!$tenantId || !$source->getKey()) {
            return;
        }

        $item = static::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('ref_tipo', $source->getMorphClass())
            ->where('ref_id', $source->getKey())
            ->first();

        if (!$item) {
            return;
        }

        $item->fill(self::normalizePayload($overrides));
        $item->save();
    }

    public function gerarNotificacao(
        string $type = 'central_item_assigned',
        ?string $title = null,
        ?string $message = null,
        array $extraData = [],
        array $opts = []
    ): void
    {
        if (!$this->tenant_id || !$this->responsavel_user_id) {
            return;
        }

        Notification::notify(
            (int) $this->tenant_id,
            (int) $this->responsavel_user_id,
            $type,
            $title ?? "Central: {$this->titulo}",
            array_merge([
                'message' => $message ?? ($this->descricao_curta ?: null),
                'icon' => 'inbox',
                'color' => 'blue',
                'link' => "/central?item={$this->id}",
                'notifiable_type' => self::class,
                'notifiable_id' => $this->id,
                'data' => array_merge([
                    'central_item_id' => $this->id,
                    'status' => $this->status?->value,
                    'prioridade' => $this->prioridade?->value,
                ], $extraData),
            ], $opts)
        );
    }

    public function registrarHistorico(
        string $action,
        mixed $from = null,
        mixed $to = null,
        ?int $userId = null
    ): CentralItemHistory {
        return $this->history()->create([
            'user_id' => $userId ?? auth()->id(),
            'action' => $action,
            'from_value' => $this->historyValue($from),
            'to_value' => $this->historyValue($to),
        ]);
    }

    private static function normalizePayload(array $payload): array
    {
        foreach ($payload as $key => $value) {
            if ($value instanceof BackedEnum) {
                $payload[$key] = $value->value;
            }
        }

        return $payload;
    }

    private function historyValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if ($value instanceof BackedEnum) {
            $value = $value->value;
        } elseif (is_array($value) || is_object($value)) {
            $value = json_encode($value, JSON_UNESCAPED_UNICODE);
        }

        return Str::limit((string) $value, 255, '');
    }
}
