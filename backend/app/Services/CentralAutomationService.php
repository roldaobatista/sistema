<?php

namespace App\Services;

use App\Models\CentralItem;
use App\Models\CentralRule;
use App\Models\User;
use App\Enums\CentralItemPriority;
use App\Enums\CentralItemStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CentralAutomationService
{
    /**
     * Aplica regras de automação quando um CentralItem é criado.
     */
    public function aplicarRegras(CentralItem $item): void
    {
        $rules = CentralRule::where('tenant_id', $item->tenant_id)
            ->ativas()
            ->where(function ($q) use ($item) {
                $q->whereNull('tipo_item')
                    ->orWhere('tipo_item', $item->tipo->value);
            })
            ->get();

        foreach ($rules as $rule) {
            try {
                $this->executarRegra($rule, $item);
            } catch (\Throwable $e) {
                Log::warning("Central: Regra #{$rule->id} falhou para item #{$item->id}", [
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Executa uma regra sobre um CentralItem.
     */
    protected function executarRegra(CentralRule $rule, CentralItem $item): void
    {
        // Verificar filtro de prioridade mínima
        if ($rule->prioridade_minima) {
            $ordemPrioridade = ['BAIXA' => 1, 'MEDIA' => 2, 'ALTA' => 3, 'URGENTE' => 4];
            $minimo = $ordemPrioridade[strtoupper((string) $rule->prioridade_minima)] ?? 0;
            $atual = $ordemPrioridade[strtoupper((string) ($item->prioridade?->value ?? 'MEDIA'))] ?? 0;

            if ($atual < $minimo) {
                return;
            }
        }

        match ($rule->acao_tipo) {
            'auto_assign' => $this->acaoAutoAssign($rule, $item),
            'set_priority' => $this->acaoSetPriority($rule, $item),
            'set_due' => $this->acaoSetDue($rule, $item),
            'notify' => $this->acaoNotify($rule, $item),
            default => null,
        };
    }

    /**
     * Auto-atribuir para um usuário ou role.
     */
    protected function acaoAutoAssign(CentralRule $rule, CentralItem $item): void
    {
        if ($item->responsavel_user_id) {
            return; // Já tem responsável
        }

        if ($rule->responsavel_user_id) {
            $item->update(['responsavel_user_id' => $rule->responsavel_user_id]);
            $item->registrarHistorico('auto_assign', null, $rule->responsavel_user_id);
            return;
        }

        // Se tem role_alvo, pega o user com menos itens abertos
        if ($rule->role_alvo) {
            $userId = $this->encontrarUserMenosOcupado(
                $item->tenant_id,
                $rule->role_alvo
            );

            if ($userId) {
                $item->update(['responsavel_user_id' => $userId]);
                $item->registrarHistorico('auto_assign', null, $userId);
            }
        }
    }

    /**
     * Definir prioridade automaticamente.
     */
    protected function acaoSetPriority(CentralRule $rule, CentralItem $item): void
    {
        $config = $rule->acao_config ?? [];
        $prioridade = isset($config['prioridade']) ? strtoupper((string) $config['prioridade']) : null;

        if ($prioridade && CentralItemPriority::tryFrom($prioridade)) {
            $oldPriority = $item->prioridade?->value;
            $item->update(['prioridade' => $prioridade]);
            $item->registrarHistorico('set_priority', $oldPriority, $prioridade);
        }
    }

    /**
     * Auto-definir prazo com base na configuração.
     */
    protected function acaoSetDue(CentralRule $rule, CentralItem $item): void
    {
        if ($item->due_at) {
            return;
        }

        $config = $rule->acao_config ?? [];
        $horas = $config['horas'] ?? null;

        if ($horas) {
            $dueAt = now()->addHours((int) $horas);
            $item->update(['due_at' => $dueAt]);
            $item->registrarHistorico('set_due', null, $dueAt->toDateTimeString());
        }
    }

    /**
     * Enviar notificação para responsável.
     */
    protected function acaoNotify(CentralRule $rule, CentralItem $item): void
    {
        $item->gerarNotificacao();
    }

    /**
     * Encontra o user de um role com menos itens abertos na Central.
     */
    protected function encontrarUserMenosOcupado(int $tenantId, string $role): ?int
    {
        return DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('roles.name', $role)
            ->where('model_has_roles.model_type', User::class)
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->where('users.tenant_id', $tenantId)
            ->where('users.is_active', true)
            ->select('users.id')
            ->selectRaw('(
                SELECT COUNT(*) FROM central_items
                WHERE central_items.responsavel_user_id = users.id
                AND central_items.status IN (?, ?)
                AND central_items.tenant_id = ?
            ) as open_count', [
                CentralItemStatus::ABERTO->value,
                CentralItemStatus::EM_ANDAMENTO->value,
                $tenantId,
            ])
            ->orderBy('open_count')
            ->first()?->id;
    }

    // ────────────────────────────────────────────────
    // Métodos de consulta gerencial
    // ────────────────────────────────────────────────

    /**
     * KPIs gerais da Central para o tenant.
     */
    public function kpis(int $tenantId): array
    {
        $base = CentralItem::where('tenant_id', $tenantId);

        $total = (clone $base)->count();
        $abertas = (clone $base)->where('status', CentralItemStatus::ABERTO)->count();
        $emAndamento = (clone $base)->where('status', CentralItemStatus::EM_ANDAMENTO)->count();
        $concluidas = (clone $base)->where('status', CentralItemStatus::CONCLUIDO)->count();
        $atrasadas = (clone $base)->whereNotNull('due_at')
            ->where('due_at', '<', now())
            ->whereNotIn('status', [CentralItemStatus::CONCLUIDO, CentralItemStatus::CANCELADO])
            ->count();

        $isSqlite = DB::getDriverName() === 'sqlite';
        $avgExpr = $isSqlite
            ? 'AVG(ROUND((julianday(closed_at) - julianday(created_at)) * 24)) as avg_hours'
            : 'AVG(TIMESTAMPDIFF(HOUR, created_at, closed_at)) as avg_hours';

        $tempoMedioConclusao = (clone $base)
            ->where('status', CentralItemStatus::CONCLUIDO)
            ->whereNotNull('closed_at')
            ->selectRaw($avgExpr)
            ->value('avg_hours');

        return [
            'total' => $total,
            'abertas' => $abertas,
            'em_andamento' => $emAndamento,
            'concluidas' => $concluidas,
            'atrasadas' => $atrasadas,
            'taxa_conclusao' => $total > 0 ? round(($concluidas / $total) * 100, 1) : 0,
            'tempo_medio_horas' => round($tempoMedioConclusao ?? 0, 1),
        ];
    }

    /**
     * Carga de trabalho por responsável.
     */
    public function workload(int $tenantId): array
    {
        $isSqlite = DB::getDriverName() === 'sqlite';
        $nowExpr = $isSqlite ? "datetime('now')" : 'NOW()';

        return CentralItem::where('tenant_id', $tenantId)
            ->whereNotIn('status', [CentralItemStatus::CONCLUIDO, CentralItemStatus::CANCELADO])
            ->whereNotNull('responsavel_user_id')
            ->selectRaw('responsavel_user_id, COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN due_at < {$nowExpr} THEN 1 ELSE 0 END) as atrasadas")
            ->selectRaw("SUM(CASE WHEN prioridade = ? THEN 1 ELSE 0 END) as urgentes", [CentralItemPriority::URGENTE->value])
            ->groupBy('responsavel_user_id')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'user_id' => $row->responsavel_user_id,
                'nome' => \App\Models\User::find($row->responsavel_user_id)?->name ?? 'N/A',
                'total' => $row->total,
                'atrasadas' => $row->atrasadas ?? 0,
                'urgentes' => $row->urgentes ?? 0,
            ])
            ->toArray();
    }

    /**
     * Itens atrasados agrupados por equipe/tipo.
     */
    public function overdueByTeam(int $tenantId): array
    {
        return CentralItem::where('tenant_id', $tenantId)
            ->whereNotNull('due_at')
            ->where('due_at', '<', now())
            ->whereNotIn('status', [CentralItemStatus::CONCLUIDO, CentralItemStatus::CANCELADO])
            ->selectRaw('tipo, COUNT(*) as total')
            ->selectRaw(DB::getDriverName() === 'sqlite'
                ? "AVG(ROUND((julianday('now') - julianday(due_at)) * 24)) as avg_atraso_horas"
                : "AVG(TIMESTAMPDIFF(HOUR, due_at, NOW())) as avg_atraso_horas"
            )
            ->groupBy('tipo')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'tipo' => $row->tipo,
                'total' => $row->total,
                'atraso_medio_horas' => round($row->avg_atraso_horas ?? 0, 1),
            ])
            ->toArray();
    }
}
