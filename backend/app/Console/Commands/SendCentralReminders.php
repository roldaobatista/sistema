<?php

namespace App\Console\Commands;

use App\Enums\CentralItemStatus;
use App\Models\CentralItem;
use Illuminate\Console\Command;

class SendCentralReminders extends Command
{
    protected $signature = 'central:send-reminders';
    protected $description = 'Envia notificações para itens da Central cujo remind_at passou';

    public function handle(): int
    {
        $items = CentralItem::query()
            ->with(['responsavel:id,name'])
            ->whereNotNull('remind_at')
            ->whereNull('remind_notified_at')
            ->where('remind_at', '<=', now())
            ->whereNotIn('status', [CentralItemStatus::CONCLUIDO, CentralItemStatus::CANCELADO])
            ->get();

        $sent = 0;
        foreach ($items as $item) {
            if (!$item->responsavel_user_id) {
                continue;
            }
            $item->gerarNotificacao(
                'central_reminder',
                'Lembrete: ' . $item->titulo,
                $item->descricao_curta ?: 'Horário do lembrete chegou.',
                ['remind_at' => $item->remind_at?->toIso8601String()],
                ['icon' => 'clock', 'color' => 'amber']
            );
            $item->update(['remind_notified_at' => now()]);
            $sent++;
        }

        if ($sent > 0) {
            $this->info("Enviadas {$sent} notificações de lembrete.");
        }

        return Command::SUCCESS;
    }
}
