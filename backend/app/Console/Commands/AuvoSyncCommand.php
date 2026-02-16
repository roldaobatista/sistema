<?php

namespace App\Console\Commands;

use App\Models\AuvoImport;
use App\Models\Role;
use App\Models\Tenant;
use App\Services\Auvo\AuvoApiClient;
use App\Services\Auvo\AuvoImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class AuvoSyncCommand extends Command
{
    protected $signature = 'auvo:sync
        {entity? : Entity type to sync (e.g. customers, equipments). Omit for all.}
        {--tenant= : Tenant ID (required)}
        {--strategy=skip : Duplicate strategy: skip or update}';

    protected $description = 'Sync data from Auvo API v2 into Kalibrium';

    public function handle(): int
    {
        $tenantId = (int) $this->option('tenant');
        if (!$tenantId) {
            $this->error('--tenant is required');
            return self::FAILURE;
        }

        $tenant = Tenant::find($tenantId);
        if (!$tenant) {
            $this->error("Tenant #{$tenantId} not found");
            return self::FAILURE;
        }

        $client = AuvoApiClient::forTenant($tenantId);
        if (!$client->hasCredentials()) {
            $this->error('Credenciais Auvo não configuradas. Configure via UI ou defina AUVO_API_KEY e AUVO_API_TOKEN no .env');
            return self::FAILURE;
        }

        $strategy = $this->option('strategy');
        $entity = $this->argument('entity');

        $service = new AuvoImportService($client);

        // Use a system user ID (first admin) for the import record
        $adminUser = $tenant->users()->whereHas('roles', fn($q) => $q->whereIn('name', [Role::SUPER_ADMIN, Role::ADMIN]))->first();
        $userId = $adminUser?->id ?? 1;

        if ($entity) {
            if (!isset(AuvoImport::ENTITY_TYPES[$entity])) {
                $this->error("Invalid entity: {$entity}. Valid: " . implode(', ', array_keys(AuvoImport::ENTITY_TYPES)));
                return self::FAILURE;
            }

            $this->info("Syncing {$entity} for tenant #{$tenantId}...");

            try {
                $result = $service->importEntity($entity, $tenantId, $userId, $strategy);
                $this->table(
                    ['Metric', 'Count'],
                    [
                        ['Total fetched', $result['total_fetched'] ?? 0],
                        ['Inserted', $result['total_imported'] ?? 0],
                        ['Updated', $result['total_updated'] ?? 0],
                        ['Skipped', $result['total_skipped'] ?? 0],
                        ['Errors', $result['total_errors'] ?? 0],
                    ]
                );
            } catch (\Throwable $e) {
                $this->error("Import failed: {$e->getMessage()}");
                Log::error('auvo:sync command failed', ['entity' => $entity, 'error' => $e->getMessage()]);
                return self::FAILURE;
            }
        } else {
            $this->info("Full sync for tenant #{$tenantId} (all entities in order)...");

            try {
                $results = $service->importAll($tenantId, $userId, $strategy);

                foreach ($results as $ent => $result) {
                    $status = $result['status'] ?? 'done';
                    $inserted = $result['total_imported'] ?? 0;
                    $errors = $result['total_errors'] ?? 0;

                    $icon = $status === 'failed' ? '✗' : '✓';
                    $this->line("{$icon} {$ent}: {$inserted} imported, {$errors} errors");
                }
            } catch (\Throwable $e) {
                $this->error("Full import failed: {$e->getMessage()}");
                Log::error('auvo:sync full import failed', ['error' => $e->getMessage()]);
                return self::FAILURE;
            }
        }

        $this->info('Sync completed.');
        return self::SUCCESS;
    }
}
