<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\InmetroXmlImportService;
use App\Services\InmetroLeadService;
use App\Services\InmetroNotificationService;
use Illuminate\Console\Command;

class SyncInmetroData extends Command
{
    protected $signature = 'inmetro:sync
        {--tenant= : Specific tenant ID}
        {--uf= : Override UFs (comma-separated, e.g. MT,MS,GO)}
        {--types= : Comma-separated instrument types (default: all)}
        {--skip-notifications : Skip notification checks}';

    protected $description = 'Sync INMETRO open data (XML) — multi-UF, multi-type import with tenant config. Runs daily.';

    public function handle(
        InmetroXmlImportService $xmlService,
        InmetroLeadService $leadService,
        InmetroNotificationService $notificationService,
    ): int {
        $tenantId = $this->option('tenant');
        $ufOverride = $this->option('uf');
        $typesOption = $this->option('types');
        $types = $typesOption ? explode(',', $typesOption) : null;
        $skipNotifications = $this->option('skip-notifications');

        $tenants = $tenantId
            ? Tenant::where('id', $tenantId)->get()
            : Tenant::where('status', 'active')->get();

        $this->info('Available instrument types: ' . implode(', ', array_keys(InmetroXmlImportService::INSTRUMENT_TYPES)));
        $this->newLine();

        foreach ($tenants as $tenant) {
            $config = $tenant->inmetro_config ?? InmetroXmlImportService::defaultConfig();

            $ufs = $ufOverride
                ? explode(',', strtoupper($ufOverride))
                : ($config['monitored_ufs'] ?? ['MT']);

            $configTypes = $types ?? ($config['instrument_types'] ?? null);

            $this->info("═══ Syncing tenant: {$tenant->name} ═══");
            $this->info("  UFs: " . implode(', ', $ufs));
            $this->info("  Types: " . ($configTypes ? implode(', ', $configTypes) : 'ALL'));
            $this->newLine();

            // Import competitors for each UF
            foreach ($ufs as $uf) {
                $competitorResult = $xmlService->importCompetitors($tenant->id, $uf);
                if ($competitorResult['success']) {
                    $stats = $competitorResult['stats'];
                    $this->info("  ✅ Competitors ({$uf}): {$stats['created']} created, {$stats['updated']} updated");
                } else {
                    $this->warn("  ⚠ Competitors ({$uf}): " . ($competitorResult['error'] ?? 'failed'));
                }
            }

            // Import instruments for all UFs × types
            $this->info("  Importing instruments...");
            $result = $xmlService->importAllForConfig($tenant->id, $ufs, $configTypes);
            $results = $result['results'];

            // Display per-UF summary
            foreach ($results['by_uf'] as $uf => $ufData) {
                if (!$ufData['success']) {
                    $this->warn("  ⚠ {$uf}: import failed");
                    continue;
                }

                $ufStats = $ufData['stats'];
                $tableRows = [];
                foreach ($ufStats['by_type'] as $slug => $typeData) {
                    $status = $typeData['success'] ? '✅' : '⚠';
                    $created = $typeData['stats']['instruments_created'] ?? 0;
                    $updated = $typeData['stats']['instruments_updated'] ?? 0;
                    $owners = ($typeData['stats']['owners_created'] ?? 0) + ($typeData['stats']['owners_updated'] ?? 0);
                    $error = $typeData['error'] ?? '-';
                    $tableRows[] = [$status, $typeData['label'], $created, $updated, $owners, $error];
                }

                $this->info("  ── {$uf} ──");
                $this->table(
                    ['', 'Type', 'Created', 'Updated', 'Owners', 'Error'],
                    $tableRows
                );
            }

            // Grand totals
            $gt = $results['grand_totals'];
            $this->info("  Grand totals across {$results['total_ufs']} UF(s):");
            $this->info("    Instruments: {$gt['instruments_created']} created, {$gt['instruments_updated']} updated");
            $this->info("    Owners: {$gt['owners_created']} created, {$gt['owners_updated']} updated");

            // Recalculate priorities (now includes critical for rejected + revenue estimation)
            $priorityStats = $leadService->recalculatePriorities($tenant->id);
            $this->info("  Priorities: " . json_encode($priorityStats));

            // Link repairs to competitors (match executor names)
            $this->info("  Linking repair history to competitors...");
            $linkedCount = $xmlService->linkRepairsToCompetitors($tenant->id);
            $this->info("  Repair→Competitor links: {$linkedCount}");

            // Generate notifications (rejections, expirations, new competitors)
            if (!$skipNotifications) {
                $this->info("  Checking for notifications...");
                $notifStats = $notificationService->runAllChecks($tenant->id);
                $this->info("  🔴 Rejection alerts: {$notifStats['rejections']}");
                $this->info("  🟡 Expiration alerts: {$notifStats['expirations']}");
                $this->info("  ⚠️ New competitor alerts: {$notifStats['new_competitors']}");
            }

            $this->newLine();
        }

        $this->info('✅ INMETRO sync completed.');
        return self::SUCCESS;
    }
}
