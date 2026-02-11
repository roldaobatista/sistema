<?php

namespace App\Listeners;

use App\Enums\CentralItemPriority;
use App\Enums\CentralItemType;
use App\Events\ContractRenewing;
use App\Models\CentralItem;
use Illuminate\Contracts\Queue\ShouldQueue;

class CreateCentralItemOnContract implements ShouldQueue
{
    public function handle(ContractRenewing $event): void
    {
        $contract = $event->contract;

        $responsavel = $contract->assigned_to ?? $contract->created_by ?? auth()->id();

        CentralItem::criarDeOrigem(
            model: $contract,
            tipo: CentralItemType::CONTRATO,
            titulo: "Contrato renovando — {$contract->customer?->name}",
            responsavelId: $responsavel,
            extras: [
                'prioridade' => CentralItemPriority::MEDIA,
                'due_at' => $contract->end_date,
                'descricao_curta' => "Contrato #{$contract->id} expira em breve",
                'contexto' => [
                    'contrato_id' => $contract->id,
                    'cliente' => $contract->customer?->name,
                    'renovacao' => $contract->end_date?->toDateString(),
                    'link' => "/contratos/{$contract->id}",
                ],
            ]
        );
    }
}
