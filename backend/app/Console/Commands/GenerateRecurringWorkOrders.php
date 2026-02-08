<?php

namespace App\Console\Commands;

use App\Models\RecurringContract;
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
                $generated++;
            } catch (\Throwable $e) {
                $this->error("✗ Contrato #{$contract->id}: {$e->getMessage()}");
            }
        }

        $this->info("Total: {$generated} OS geradas.");
        return self::SUCCESS;
    }
}
