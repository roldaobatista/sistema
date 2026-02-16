<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\CollectionAutomationService;
use Illuminate\Console\Command;

class RunCollectionAutomation extends Command
{
    protected $signature = 'collection:run {--tenant= : ID do tenant específico}';
    protected $description = 'Executa a régua de cobrança automatizada para todos os tenants';

    public function handle(CollectionAutomationService $service): int
    {
        $tenantId = $this->option('tenant');
        $tenants = $tenantId
            ? Tenant::where('id', $tenantId)->get()
            : Tenant::all();

        foreach ($tenants as $tenant) {
            $this->info("Processando cobranças: {$tenant->name} (ID: {$tenant->id})");

            try {
                $results = $service->processForTenant($tenant->id);
                $this->info("  → {$results['processed']} parcelas verificadas, {$results['sent']} ações enviadas.");
            } catch (\Throwable $e) {
                $this->error("  → Erro: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
