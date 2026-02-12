<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\InmetroXmlImportService;
use App\Services\InmetroLeadService;
use Illuminate\Console\Command;

class SyncInmetroData extends Command
{
    protected $signature = 'inmetro:sync {--tenant= : Specific tenant ID} {--uf=MT : State to sync}';
    protected $description = 'Weekly sync of INMETRO open data (XML) and lead priority recalculation';

    public function handle(InmetroXmlImportService $xmlService, InmetroLeadService $leadService): int
    {
        $uf = $this->option('uf');
        $tenantId = $this->option('tenant');

        $tenants = $tenantId
            ? Tenant::where('id', $tenantId)->get()
            : Tenant::where('status', 'active')->get();

        foreach ($tenants as $tenant) {
            $this->info("Syncing INMETRO data for tenant: {$tenant->name} (UF: {$uf})");

            $competitorResult = $xmlService->importCompetitors($tenant->id, $uf);
            if ($competitorResult['success']) {
                $stats = $competitorResult['stats'];
                $this->info("  Competitors: {$stats['created']} created, {$stats['updated']} updated, {$stats['errors']} errors");
            } else {
                $this->warn("  Competitors import failed: " . ($competitorResult['error'] ?? 'unknown'));
            }

            $instrumentResult = $xmlService->importInstruments($tenant->id, $uf);
            if ($instrumentResult['success']) {
                $stats = $instrumentResult['stats'];
                $this->info("  Instruments: {$stats['instruments_created']} created, {$stats['instruments_updated']} updated");
                $this->info("  Owners: {$stats['owners_created']} created, {$stats['owners_updated']} updated");
            } else {
                $this->warn("  Instruments import failed: " . ($instrumentResult['error'] ?? 'unknown'));
            }

            $priorityStats = $leadService->recalculatePriorities($tenant->id);
            $this->info("  Priorities: " . json_encode($priorityStats));

            $alertCount = $leadService->generateExpirationAlerts($tenant->id);
            $this->info("  Alerts generated: {$alertCount}");
        }

        $this->info('INMETRO sync completed.');
        return self::SUCCESS;
    }
}
