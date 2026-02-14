<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ProcessWorkOrderRecurrences extends Command
{
    protected $signature = 'app:process-work-order-recurrences';
    protected $description = 'Process all active work order recurrences and generate due OS';

    public function handle(\App\Services\Search\WorkOrderRecurrenceService $service)
    {
        $this->info('Iniciando processamento de recorrências de OS...');
        
        $count = $service->processAll();
        
        $this->info("Concluído. {$count} Ordens de Serviço geradas.");
        
        return 0;
    }
}
