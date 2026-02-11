<?php

namespace App\Listeners;

use App\Enums\CentralItemPriority;
use App\Enums\CentralItemType;
use App\Events\QuoteApproved;
use App\Models\CentralItem;
use Illuminate\Contracts\Queue\ShouldQueue;

class CreateCentralItemOnQuote implements ShouldQueue
{
    public function handle(QuoteApproved $event): void
    {
        $quote = $event->quote;

        $responsavel = $quote->seller_id ?? $event->user->id;

        CentralItem::criarDeOrigem(
            model: $quote,
            tipo: CentralItemType::ORCAMENTO,
            titulo: "Orcamento #{$quote->quote_number} aprovado - {$quote->customer?->name}",
            responsavelId: $responsavel,
            extras: [
                'prioridade' => CentralItemPriority::ALTA,
                'descricao_curta' => 'Valor: R$ ' . number_format((float) ($quote->total ?? 0), 2, ',', '.'),
                'contexto' => [
                    'numero' => $quote->quote_number,
                    'cliente' => $quote->customer?->name,
                    'valor' => $quote->total,
                    'link' => "/orcamentos/{$quote->id}",
                ],
            ]
        );
    }
}
