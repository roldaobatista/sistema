<?php

namespace App\Console\Commands;

use App\Enums\CentralItemOrigin;
use App\Enums\CentralItemPriority;
use App\Enums\CentralItemStatus;
use App\Enums\CentralItemType;
use App\Enums\CentralItemVisibility;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\CentralItem;
use App\Models\Tenant;
use Illuminate\Console\Command;

class ScanOverdueFinancials extends Command
{
    protected $signature = 'central:scan-financials';
    protected $description = 'Varre contas a receber/pagar vencidas ou próximas do vencimento e cria CentralItems';

    public function handle(): int
    {
        $tenants = Tenant::where('status', Tenant::STATUS_ACTIVE)->get();
        $created = 0;

        foreach ($tenants as $tenant) {
            app()->instance('current_tenant_id', $tenant->id);

            $created += $this->processReceivables($tenant);
            $created += $this->processPayables($tenant);
        }

        $this->info("Central: {$created} itens financeiros criados/atualizados");

        return self::SUCCESS;
    }

    private function processReceivables(Tenant $tenant): int
    {
        $count = 0;
        $limiteAlerta = now()->addDays(3);

        // Busca recebíveis pendentes com vencimento nos próximos 3 dias ou já vencidos
        $receivables = AccountReceivable::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('status', '!=', AccountReceivable::STATUS_PAID)
            ->where(function ($q) use ($limiteAlerta) {
                $q->where('due_date', '<=', $limiteAlerta)
                  ->whereNotNull('due_date');
            })
            ->get();

        foreach ($receivables as $rec) {
            $existing = CentralItem::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('ref_tipo', AccountReceivable::class)
                ->where('ref_id', $rec->id)
                ->whereNotIn('status', [CentralItemStatus::CONCLUIDO, CentralItemStatus::CANCELADO])
                ->first();

            if ($existing) {
                // Atualizar prioridade conforme proximidade
                $existing->update(['prioridade' => $this->calcularPrioridade($rec->due_date)]);
                continue;
            }

            CentralItem::withoutGlobalScopes()->create([
                'tenant_id' => $tenant->id,
                'tipo' => CentralItemType::FINANCEIRO,
                'origem' => CentralItemOrigin::JOB,
                'ref_tipo' => AccountReceivable::class,
                'ref_id' => $rec->id,
                'titulo' => "Recebível vencendo — R$ " . number_format($rec->amount ?? 0, 2, ',', '.'),
                'descricao_curta' => "Cliente: {$rec->customer?->name} | Vence: {$rec->due_date?->format('d/m/Y')}",
                'responsavel_user_id' => $rec->created_by ?? $rec->user_id ?? 1,
                'criado_por_user_id' => 0, // Sistema
                'status' => CentralItemStatus::ABERTO,
                'prioridade' => $this->calcularPrioridade($rec->due_date),
                'visibilidade' => CentralItemVisibility::EQUIPE,
                'due_at' => $rec->due_date,
                'contexto' => [
                    'tipo' => 'recebivel',
                    'valor' => $rec->amount,
                    'cliente' => $rec->customer?->name,
                    'link' => '/financeiro/receber',
                ],
            ]);
            $count++;
        }

        return $count;
    }

    private function processPayables(Tenant $tenant): int
    {
        $count = 0;
        $limiteAlerta = now()->addDays(3);

        $payables = AccountPayable::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('status', '!=', AccountPayable::STATUS_PAID)
            ->where(function ($q) use ($limiteAlerta) {
                $q->where('due_date', '<=', $limiteAlerta)
                  ->whereNotNull('due_date');
            })
            ->get();

        foreach ($payables as $pay) {
            $existing = CentralItem::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('ref_tipo', AccountPayable::class)
                ->where('ref_id', $pay->id)
                ->whereNotIn('status', [CentralItemStatus::CONCLUIDO, CentralItemStatus::CANCELADO])
                ->first();

            if ($existing) {
                $existing->update(['prioridade' => $this->calcularPrioridade($pay->due_date)]);
                continue;
            }

            CentralItem::withoutGlobalScopes()->create([
                'tenant_id' => $tenant->id,
                'tipo' => CentralItemType::FINANCEIRO,
                'origem' => CentralItemOrigin::JOB,
                'ref_tipo' => AccountPayable::class,
                'ref_id' => $pay->id,
                'titulo' => "Conta a pagar vencendo — R$ " . number_format($pay->amount ?? 0, 2, ',', '.'),
                'descricao_curta' => "Fornecedor: {$pay->supplier?->name} | Vence: {$pay->due_date?->format('d/m/Y')}",
                'responsavel_user_id' => $pay->created_by ?? $pay->user_id ?? 1,
                'criado_por_user_id' => 0,
                'status' => CentralItemStatus::ABERTO,
                'prioridade' => $this->calcularPrioridade($pay->due_date),
                'visibilidade' => CentralItemVisibility::EQUIPE,
                'due_at' => $pay->due_date,
                'contexto' => [
                    'tipo' => 'pagavel',
                    'valor' => $pay->amount,
                    'fornecedor' => $pay->supplier?->name,
                    'link' => '/financeiro/pagar',
                ],
            ]);
            $count++;
        }

        return $count;
    }

    private function calcularPrioridade($dueDate): CentralItemPriority
    {
        if (!$dueDate) {
            return CentralItemPriority::MEDIA;
        }

        $dias = now()->diffInDays($dueDate, false);

        if ($dias < 0) {
            return CentralItemPriority::URGENTE; // já venceu
        }
        if ($dias <= 1) {
            return CentralItemPriority::ALTA; // vence hoje ou amanhã
        }

        return CentralItemPriority::MEDIA; // vence em 2-3 dias
    }
}
