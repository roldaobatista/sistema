<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\AlertEngineService;
use Illuminate\Console\Command;

class RunAlertEngine extends Command
{
    protected $signature = 'alerts:run {--tenant= : ID do tenant específico}';
    protected $description = 'Executa o motor de alertas para todos os tenants (ou um específico)';

    public function handle(AlertEngineService $engine): int
    {
        $tenantId = $this->option('tenant');
        $tenants = $tenantId
            ? Tenant::where('id', $tenantId)->get()
            : Tenant::all();

        foreach ($tenants as $tenant) {
            $this->info("Processando tenant: {$tenant->name} (ID: {$tenant->id})");

            try {
                $results = $engine->runAllChecks($tenant->id);
                $total = array_sum($results);
                $this->info("  → {$total} alertas gerados.");

                foreach ($results as $type => $count) {
                    if ($count > 0) $this->line("    - {$type}: {$count}");
                }
            } catch (\Throwable $e) {
                $this->error("  → Erro: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
