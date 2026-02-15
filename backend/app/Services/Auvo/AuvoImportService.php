<?php

namespace App\Services\Auvo;

use App\Models\AuvoIdMapping;
use App\Models\AuvoImport;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuvoImportService
{
    private AuvoApiClient $client;

    public function __construct(AuvoApiClient $client)
    {
        $this->client = $client;
    }

    /**
     * Import all entities in dependency order.
     */
    public function importAll(int $tenantId, int $userId, string $strategy = 'skip'): array
    {
        $results = [];

        foreach (AuvoImport::IMPORT_ORDER as $entity) {
            try {
                $results[$entity] = $this->importEntity($entity, $tenantId, $userId, $strategy);
            } catch (\Throwable $e) {
                Log::error("Auvo full import failed at entity {$entity}", [
                    'error' => $e->getMessage(),
                ]);
                $results[$entity] = [
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    /**
     * Import a single entity type.
     */
    public function importEntity(string $entity, int $tenantId, int $userId, string $strategy = 'skip', array $filters = []): array
    {
        if (!AuvoFieldMapper::isValidEntity($entity)) {
            throw new \InvalidArgumentException("Entidade inválida: {$entity}");
        }

        $import = AuvoImport::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'entity_type' => $entity,
            'status' => AuvoImport::STATUS_PROCESSING,
            'duplicate_strategy' => $strategy,
            'filters' => $filters,
            'started_at' => now(),
        ]);

        try {
            $result = match ($entity) {
                AuvoImport::ENTITY_CUSTOMERS => $this->importCustomers($import, $strategy),
                AuvoImport::ENTITY_EQUIPMENTS => $this->importEquipments($import, $strategy),
                AuvoImport::ENTITY_PRODUCTS => $this->importProducts($import, $strategy),
                AuvoImport::ENTITY_SERVICES => $this->importServices($import, $strategy),
                AuvoImport::ENTITY_TASKS => $this->importTasks($import, $strategy),
                AuvoImport::ENTITY_EXPENSES => $this->importExpenses($import, $strategy),
                default => $this->importGeneric($import, $entity),
            };

            $finalStatus = ($result['total_errors'] ?? 0) > 0 && ($result['total_imported'] ?? 0) === 0
                ? AuvoImport::STATUS_FAILED
                : AuvoImport::STATUS_DONE;

            $import->update([
                'status' => $finalStatus,
                'completed_at' => now(),
                'last_synced_at' => now(),
            ]);

            $result['import_id'] = $import->id;
            $result['entity_type'] = $entity;
            $result['status'] = $finalStatus === AuvoImport::STATUS_DONE ? 'done' : 'failed';
            return $result;
        } catch (\Throwable $e) {
            $import->update([
                'status' => AuvoImport::STATUS_FAILED,
                'completed_at' => now(),
                'error_log' => [['message' => $e->getMessage()]],
            ]);
            throw $e;
        }
    }

    /**
     * Preview data from Auvo (fetch a small sample).
     */
    public function preview(string $entity, int $limit = 10): array
    {
        $endpoint = AuvoFieldMapper::getEndpoint($entity);
        $fieldMap = AuvoFieldMapper::getMap($entity);
        $records = [];

        foreach ($this->client->fetchAll($endpoint, [], $limit) as $record) {
            $mapped = AuvoFieldMapper::map($record, $fieldMap);
            $records[] = [
                'auvo_raw' => $record,
                'kalibrium_mapped' => AuvoFieldMapper::stripMetadata($mapped),
                'auvo_id' => AuvoFieldMapper::extractAuvoId($mapped),
            ];
            if (count($records) >= $limit) break;
        }

        return [
            'entity' => $entity,
            'total' => count($records),
            'sample' => $records,
            'mapped_fields' => array_values($fieldMap),
        ];
    }

    /**
     * Rollback an import batch.
     */
    public function rollback(AuvoImport $import): array
    {
        if (!in_array($import->status, [AuvoImport::STATUS_DONE, 'completed'])) {
            throw new \RuntimeException('Só é possível desfazer importações concluídas.');
        }

        $importedIds = $import->imported_ids ?? [];
        if (empty($importedIds)) {
            throw new \RuntimeException('Nenhum registro para desfazer.');
        }

        $modelClass = $this->getModelClass($import->entity_type);
        if (!$modelClass) {
            throw new \RuntimeException("Tipo de entidade inválido: {$import->entity_type}");
        }

        $deleted = 0;
        $failed = 0;

        DB::beginTransaction();
        try {
            foreach ($importedIds as $id) {
                $record = $modelClass::where('id', $id)
                    ->where('tenant_id', $import->tenant_id)
                    ->first();

                if ($record) {
                    try {
                        $record->delete();
                        $deleted++;
                    } catch (\Throwable $e) {
                        $failed++;
                        Log::warning('Auvo rollback failed for record', [
                            'import_id' => $import->id,
                            'record_id' => $id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }

            // Also remove ID mappings
            AuvoIdMapping::deleteMappingsForLocalIds(
                $import->entity_type,
                $importedIds,
                $import->tenant_id
            );

            $import->update([
                'status' => AuvoImport::STATUS_ROLLED_BACK,
                'imported_ids' => [],
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return [
            'deleted' => $deleted,
            'failed' => $failed,
            'status' => AuvoImport::STATUS_ROLLED_BACK,
            'total' => count($importedIds),
        ];
    }

    // ─── Entity Importers ───────────────────────────────────

    private function importCustomers(AuvoImport $import, string $strategy): array
    {
        return $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            // Auvo V2 returns email and phoneNumber as arrays — extract first element
            if (isset($data['email']) && is_array($data['email'])) {
                $data['email'] = $data['email'][0] ?? null;
            }
            if (isset($data['phone']) && is_array($data['phone'])) {
                $data['phone'] = $data['phone'][0] ?? null;
            }

            // Normalize document
            if (!empty($data['document'])) {
                $data['document'] = preg_replace('/\D/', '', $data['document']);
            }

            // Auto-detect PF/PJ
            if (!empty($data['document'])) {
                $docLen = strlen($data['document']);
                $data['type'] = $docLen <= 11 ? 'PF' : 'PJ';
            }

            // Normalize ZIP
            if (!empty($data['address_zip'])) {
                $data['address_zip'] = preg_replace('/\D/', '', $data['address_zip']);
            }

            // Status mapping (Auvo V2 uses boolean 'active' field)
            if (isset($data['is_active'])) {
                $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
            } else {
                $data['is_active'] = true;
            }

            return $data;
        }, function (array $data, int $tenantId) {
            // Duplicate detection by document
            if (!empty($data['document'])) {
                return Customer::where('tenant_id', $tenantId)
                    ->where('document', $data['document'])
                    ->first();
            }
            // Fallback: by name
            if (!empty($data['name'])) {
                return Customer::where('tenant_id', $tenantId)
                    ->where('name', $data['name'])
                    ->first();
            }
            return null;
        }, Customer::class);
    }

    private function importEquipments(AuvoImport $import, string $strategy): array
    {
        return $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            // Resolve customer via ID mapping
            $customerAuvoId = $mapped['_customer_auvo_id'] ?? null;
            if ($customerAuvoId) {
                $localCustomerId = AuvoIdMapping::findLocal('customers', (int) $customerAuvoId, $import->tenant_id);
                if ($localCustomerId) {
                    $data['customer_id'] = $localCustomerId;
                }
            }

            // Resolve category
            if (!empty($mapped['_category_name'])) {
                $data['type'] = strtolower($mapped['_category_name']);
            }

            // Auto-generate code if missing
            if (empty($data['code'])) {
                $data['code'] = Equipment::generateCode($import->tenant_id);
            }

            return $data;
        }, function (array $data, int $tenantId) {
            if (!empty($data['serial_number'])) {
                return Equipment::where('tenant_id', $tenantId)
                    ->where('serial_number', $data['serial_number'])
                    ->first();
            }
            return null;
        }, Equipment::class);
    }

    private function importProducts(AuvoImport $import, string $strategy): array
    {
        return $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            // Resolve category
            if (!empty($mapped['_category_name'])) {
                $cat = ProductCategory::firstOrCreate(
                    ['tenant_id' => $import->tenant_id, 'name' => $mapped['_category_name']],
                    ['tenant_id' => $import->tenant_id, 'name' => $mapped['_category_name']]
                );
                $data['category_id'] = $cat->id;
            }

            // Normalize prices
            foreach (['sell_price', 'cost_price'] as $priceField) {
                if (isset($data[$priceField]) && is_string($data[$priceField])) {
                    $data[$priceField] = bcadd(str_replace(',', '.', $data[$priceField]), '0', 2);
                }
            }

            return $data;
        }, function (array $data, int $tenantId) {
            if (!empty($data['code'])) {
                return Product::where('tenant_id', $tenantId)->where('code', $data['code'])->first();
            }
            if (!empty($data['name'])) {
                return Product::where('tenant_id', $tenantId)->where('name', $data['name'])->first();
            }
            return null;
        }, Product::class);
    }

    private function importServices(AuvoImport $import, string $strategy): array
    {
        return $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            if (isset($data['default_price']) && is_string($data['default_price'])) {
                $data['default_price'] = bcadd(str_replace(',', '.', $data['default_price']), '0', 2);
            }

            return $data;
        }, function (array $data, int $tenantId) {
            if (!empty($data['code'])) {
                return Service::where('tenant_id', $tenantId)->where('code', $data['code'])->first();
            }
            if (!empty($data['name'])) {
                return Service::where('tenant_id', $tenantId)->where('name', $data['name'])->first();
            }
            return null;
        }, Service::class);
    }

    private function importTasks(AuvoImport $import, string $strategy): array
    {
        // Tasks are complex — import header first, then we store the mapping
        // Items (products/services/costs) would require sub-queries to /tasks/{id}/products etc.
        return $this->importGeneric($import, 'tasks');
    }

    private function importExpenses(AuvoImport $import, string $strategy): array
    {
        return $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            // Resolve user via mapping
            $userAuvoId = $mapped['_user_auvo_id'] ?? null;
            if ($userAuvoId) {
                $localUserId = AuvoIdMapping::findLocal('users', (int) $userAuvoId, $import->tenant_id);
                if ($localUserId) {
                    $data['user_id'] = $localUserId;
                }
            }

            // Resolve task via mapping
            $taskAuvoId = $mapped['_task_auvo_id'] ?? null;
            if ($taskAuvoId) {
                $localTaskId = AuvoIdMapping::findLocal('tasks', (int) $taskAuvoId, $import->tenant_id);
                if ($localTaskId) {
                    $data['work_order_id'] = $localTaskId;
                }
            }

            // Resolve expense category
            if (!empty($mapped['_type_name'])) {
                $cat = ExpenseCategory::firstOrCreate(
                    ['tenant_id' => $import->tenant_id, 'name' => $mapped['_type_name']],
                    ['tenant_id' => $import->tenant_id, 'name' => $mapped['_type_name']]
                );
                $data['category_id'] = $cat->id;
            }

            // Normalize amount
            if (isset($data['amount']) && is_string($data['amount'])) {
                $data['amount'] = bcadd(str_replace(',', '.', $data['amount']), '0', 2);
            }

            return $data;
        }, function (array $data, int $tenantId) {
            // Expenses don't have a natural unique key — rely on AuvoIdMapping
            return null;
        }, Expense::class);
    }

    /**
     * Generic importer for entities without special logic (segments, keywords, etc.).
     * Just stores the ID mapping without creating Kalibrium records.
     */
    private function importGeneric(AuvoImport $import, string $entity): array
    {
        $endpoint = AuvoFieldMapper::getEndpoint($entity);
        $fieldMap = AuvoFieldMapper::getMap($entity);

        $totalFetched = 0;
        $imported = 0;
        $skipped = 0;
        $errors = 0;
        $errorLog = [];

        foreach ($this->client->fetchAll($endpoint) as $record) {
            $totalFetched++;

            try {
                $mapped = AuvoFieldMapper::map($record, $fieldMap);
                $auvoId = AuvoFieldMapper::extractAuvoId($mapped);

                if ($auvoId && AuvoIdMapping::isMapped($entity, $auvoId, $import->tenant_id)) {
                    $skipped++;
                    continue;
                }

                // For generic entities we just store the mapping
                if ($auvoId) {
                    AuvoIdMapping::mapOrCreate($entity, $auvoId, null, $import->tenant_id);
                }

                $imported++;
            } catch (\Throwable $e) {
                $errors++;
                $errorLog[] = [
                    'message' => $e->getMessage(),
                    'data' => $record,
                ];
            }
        }

        $import->update([
            'total_fetched' => $totalFetched,
            'total_imported' => $imported,
            'total_skipped' => $skipped,
            'total_errors' => $errors,
            'error_log' => $errorLog ?: null,
        ]);

        return [
            'total_fetched' => $totalFetched,
            'total_imported' => $imported,
            'total_updated' => 0,
            'total_skipped' => $skipped,
            'total_errors' => $errors,
        ];
    }

    // ─── Shared Import Logic ────────────────────────────────

    /**
     * Generic import-with-mapping pattern used by all entity importers.
     *
     * @param AuvoImport $import The import record
     * @param string $strategy 'skip' or 'update'
     * @param callable $transformer Transforms mapped Auvo data to persistable data
     * @param callable $duplicateFinder Finds existing record by natural key
     * @param string $modelClass The Eloquent model class
     */
    private function importWithMapping(
        AuvoImport $import,
        string $strategy,
        callable $transformer,
        callable $duplicateFinder,
        string $modelClass
    ): array {
        $entity = $import->entity_type;
        $endpoint = AuvoFieldMapper::getEndpoint($entity);
        $fieldMap = AuvoFieldMapper::getMap($entity);

        $totalFetched = 0;
        $inserted = 0;
        $updated = 0;
        $skipped = 0;
        $errors = 0;
        $errorLog = [];
        $importedIds = [];

        foreach ($this->client->fetchAll($endpoint) as $record) {
            $totalFetched++;

            try {
                DB::beginTransaction();

                $mapped = AuvoFieldMapper::map($record, $fieldMap);
                $auvoId = AuvoFieldMapper::extractAuvoId($mapped);

                // Check if already mapped
                if ($auvoId) {
                    $existingLocalId = AuvoIdMapping::findLocal($entity, $auvoId, $import->tenant_id);
                    if ($existingLocalId && $strategy === 'skip') {
                        $skipped++;
                        DB::commit();
                        continue;
                    }
                }

                // Transform data
                $data = $transformer($mapped);
                $data['tenant_id'] = $import->tenant_id;

                // Check for duplicate by natural key
                $existing = $duplicateFinder($data, $import->tenant_id);

                if ($existing) {
                    if ($strategy === 'skip') {
                        // Still create the ID mapping even if skipping
                        if ($auvoId) {
                            $mapping = AuvoIdMapping::mapOrCreate($entity, $auvoId, $existing->id, $import->tenant_id);
                            $mapping->update(['import_id' => $import->id]);
                        }
                        $skipped++;
                    } else {
                        // Update existing
                        unset($data['tenant_id']);
                        $fillable = array_intersect_key($data, array_flip((new $modelClass)->getFillable()));
                        $existing->update(array_filter($fillable, fn($v) => $v !== '' && $v !== null));
                        if ($auvoId) {
                            $mapping = AuvoIdMapping::mapOrCreate($entity, $auvoId, $existing->id, $import->tenant_id);
                            $mapping->update(['import_id' => $import->id]);
                        }
                        $updated++;
                    }
                } else {
                    // Create new
                    $instance = new $modelClass;
                    $fillable = array_intersect_key($data, array_flip($instance->getFillable()));

                    if (in_array('is_active', $instance->getFillable()) && !isset($fillable['is_active'])) {
                        $fillable['is_active'] = true;
                    }

                    $created = $modelClass::create($fillable);
                    $importedIds[] = $created->id;

                    if ($auvoId) {
                        $mapping = AuvoIdMapping::mapOrCreate($entity, $auvoId, $created->id, $import->tenant_id);
                        $mapping->update(['import_id' => $import->id]);
                    }

                    $inserted++;
                }

                DB::commit();
            } catch (\Throwable $e) {
                DB::rollBack();
                $errors++;

                Log::warning('Auvo import row error', [
                    'import_id' => $import->id,
                    'entity' => $entity,
                    'error' => $e->getMessage(),
                ]);

                $errorLog[] = [
                    'message' => $e->getMessage(),
                    'data' => $record,
                ];
            }
        }

        $import->update([
            'total_fetched' => $totalFetched,
            'total_imported' => $inserted,
            'total_updated' => $updated,
            'total_skipped' => $skipped,
            'total_errors' => $errors,
            'error_log' => $errorLog ?: null,
            'imported_ids' => $importedIds ?: null,
        ]);

        return [
            'total_fetched' => $totalFetched,
            'total_imported' => $inserted,
            'total_updated' => $updated,
            'total_skipped' => $skipped,
            'total_errors' => $errors,
        ];
    }

    /**
     * Get the model class for an entity type.
     */
    private function getModelClass(string $entity): ?string
    {
        return match ($entity) {
            'customers' => Customer::class,
            'equipments' => Equipment::class,
            'products' => Product::class,
            'services' => Service::class,
            'expenses' => Expense::class,
            default => null,
        };
    }
}
