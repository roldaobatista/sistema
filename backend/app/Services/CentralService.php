<?php

namespace App\Services;

use App\Enums\CentralItemOrigin;
use App\Enums\CentralItemPriority;
use App\Enums\CentralItemStatus;
use App\Enums\CentralItemType;
use App\Enums\CentralItemVisibility;
use App\Models\CentralItem;
use App\Models\CentralItemComment;
use BackedEnum;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class CentralService
{
    public function listar(array $filters, int $perPage = 20): LengthAwarePaginator
    {
        $query = CentralItem::query()
            ->with(['responsavel:id,name', 'criadoPor:id,name', 'source']);

        // Filtro de Responsável / Visibilidade
        $userId = request()->user()?->id;
        
        // Se user tem permissão de ver time, vê itens do time. Se empresa, vê tudo.
        // Implementação básica: vê itens onde é responsável OU visibilidade permite
        $query->where(function ($q) use ($userId) {
            $q->where('responsavel_user_id', $userId)
              ->orWhere('visibilidade', CentralItemVisibility::EQUIPE) // Ajustar logica de time futuramente
              ->orWhere('visibilidade', CentralItemVisibility::EMPRESA)
              ->orWhere('criado_por_user_id', $userId);
        });

        // Search
        if (!empty($filters['search'])) {
            $s = $filters['search'];
            $query->where(fn($q) => 
                $q->where('titulo', 'like', "%{$s}%")
                  ->orWhere('descricao_curta', 'like', "%{$s}%")
                  ->orWhere('ref_id', 'like', "%{$s}%")
            );
        }

        // Tipo
        if (!empty($filters['tipo'])) {
            $query->where('tipo', strtoupper((string) $filters['tipo']));
        }

        // Status
        if (!empty($filters['status'])) {
            $statuses = array_map(fn ($s) => strtoupper((string) $s), (array) $filters['status']);
            $query->whereIn('status', $statuses);
        }

        // Prioridade
        if (!empty($filters['prioridade'])) {
            $query->where('prioridade', strtoupper((string) $filters['prioridade']));
        }

        // Aba: Hoje, Atrasadas, Sem Prazo
        $tab = $filters['tab'] ?? $filters['aba'] ?? null;
        if (!empty($tab)) {
            match($tab) {
                'hoje' => $query->hoje(),
                'atrasadas' => $query->atrasados(),
                'sem_prazo' => $query->semPrazo(),
                default => null,
            };
        }

        // Sorting
        $sort = $filters['sort_by'] ?? 'created_at';
        $dir = $filters['sort_dir'] ?? 'desc';
        
        // Smart sort for inbox
        if (empty($filters['sort_by'])) {
            $query->orderByRaw("CASE WHEN prioridade = 'URGENTE' THEN 1 ELSE 2 END ASC")
                  ->orderBy('due_at', 'asc')
                  ->orderBy('created_at', 'desc');
        } else {
            $query->orderBy($sort, $dir);
        }

        return $query->paginate($perPage);
    }

    public function criar(array $data): CentralItem
    {
        return DB::transaction(function () use ($data) {
            $user = request()->user();
            $data['tenant_id'] = app()->bound('current_tenant_id')
                ? app('current_tenant_id')
                : $user->tenant_id;
            $data['criado_por_user_id'] = $user->id;
            $data['responsavel_user_id'] ??= $user->id;
            
            // Garantir defaults
            $data['status'] ??= CentralItemStatus::ABERTO;
            $data['prioridade'] ??= CentralItemPriority::MEDIA;
            $data['origem'] ??= CentralItemOrigin::MANUAL;
            $data['visibilidade'] ??= CentralItemVisibility::PRIVADO;

            $data = $this->normalizeItemPayload($data);
            $item = CentralItem::create($data);

            $this->logHistory($item, 'created');
            app(CentralAutomationService::class)->aplicarRegras($item);
            $item->refresh();
            
            // Se responsável for outro, notificar
            if ($item->responsavel_user_id && $item->responsavel_user_id !== $user->id) {
                // TODO: Notification::create(...)
            }

            return $item;
        });
    }

    public function atualizar(CentralItem $item, array $data): CentralItem
    {
        return DB::transaction(function () use ($item, $data) {
            $oldStatus = $item->status;
            $oldResponsavel = $item->responsavel_user_id;

            $data = $this->normalizeItemPayload($data);
            $item->update($data);

            // History logs
            if ($item->status !== $oldStatus) {
                $this->logHistory($item, 'status_changed', $oldStatus->value, $item->status->value);
            }
            if (isset($data['responsavel_user_id']) && $data['responsavel_user_id'] != $oldResponsavel) {
                $this->logHistory($item, 'assigned', $oldResponsavel, $data['responsavel_user_id']);
                // TODO: Notificar novo responsável
            }
            if (isset($data['snooze_until'])) {
                $this->logHistory($item, 'snoozed', null, $data['snooze_until']);
            }

            return $item;
        });
    }

    public function comentar(CentralItem $item, string $body, int $userId): CentralItemComment
    {
        return $item->comments()->create([
            'user_id' => $userId,
            'body' => $body,
        ]);
    }

    public function resumo(): array
    {
        $userId = request()->user()?->id;
        $base = CentralItem::query()->doUsuario($userId);
        $abertas = (clone $base)
            ->whereNotIn('status', [CentralItemStatus::CONCLUIDO, CentralItemStatus::CANCELADO])
            ->count();

        return [
            'hoje' => (clone $base)->hoje()->count(),
            'atrasadas' => (clone $base)->atrasados()->count(),
            'sem_prazo' => (clone $base)->semPrazo()->count(),
            'total_aberto' => $abertas,
            'abertas' => $abertas,
            'urgentes' => (clone $base)
                ->where('prioridade', CentralItemPriority::URGENTE)
                ->whereNotIn('status', [CentralItemStatus::CONCLUIDO, CentralItemStatus::CANCELADO])
                ->count(),
        ];
    }

    private function logHistory(CentralItem $item, string $action, ?string $from = null, ?string $to = null): void
    {
        $item->history()->create([
            'user_id' => request()->user()?->id,
            'action' => $action,
            'from_value' => $from,
            'to_value' => $to,
        ]);
    }

    private function normalizeItemPayload(array $payload): array
    {
        foreach ($payload as $key => $value) {
            if ($value instanceof BackedEnum) {
                $payload[$key] = $value->value;
            }
        }

        foreach (['tipo', 'status', 'prioridade', 'origem', 'visibilidade'] as $enumKey) {
            if (array_key_exists($enumKey, $payload) && $payload[$enumKey] !== null) {
                $payload[$enumKey] = strtoupper((string) $payload[$enumKey]);
            }
        }

        return $payload;
    }
}
