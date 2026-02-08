<?php

namespace App\Console\Commands;

use App\Models\RecurringContract;
use App\Models\Notification;
use Illuminate\Console\Command;

class GenerateRecurringWorkOrders extends Command
{
    protected $signature = 'app:generate-recurring-work-orders';
    protected $description = 'Gera OS automáticas para contratos recorrentes com next_run_date <= hoje';

    public function handle(): int
    {
        $contracts = RecurringContract::where('is_active', true)
            ->where('next_run_date', '<=', now()->toDateString())
            ->with('items')
            ->get();

        if ($contracts->isEmpty()) {
            $this->info('Nenhum contrato recorrente pendente.');
            return self::SUCCESS;
        }

        $generated = 0;
        foreach ($contracts as $contract) {
            try {
                $wo = $contract->generateWorkOrder();
                $this->line("✓ Contrato #{$contract->id} \"{$contract->name}\" → OS #{$wo->number}");

                // Gap #21 — Notificar técnico e criador
                $notifyIds = array_filter(array_unique([
                    $wo->assigned_to,
                    $contract->created_by,
                ]));
                foreach ($notifyIds as $uid) {
                    Notification::create([
                        'tenant_id' => $contract->tenant_id,
                        'user_id' => $uid,
                        'type' => 'recurring_os_generated',
                        'title' => "Nova OS {$wo->number} gerada automaticamente",
                        'data' => json_encode([
                            'message' => "Contrato recorrente: {$contract->name}",
                            'work_order_id' => $wo->id,
                            'link' => "/os/{$wo->id}",
                        ]),
                    ]);
                }

                $generated++;
            } catch (\Throwable $e) {
                $this->error("✗ Contrato #{$contract->id}: {$e->getMessage()}");
            }
        }

        $this->info("Total: {$generated} OS geradas.");
        return self::SUCCESS;
    }
}
