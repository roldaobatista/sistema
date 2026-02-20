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
use App\Models\Quote;
use App\Models\Service;
use App\Models\WorkOrder;
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
                'quotations' => $this->importQuotations($import, $strategy),
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

        $visibleFields = array_values(array_filter($fieldMap, fn($v) => !str_starts_with($v, '_')));

        return [
            'entity' => $entity,
            'total' => count($records),
            'sample' => $records,
            'mapped_fields' => $visibleFields,
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
        $failedIds = [];

        // Delete each record individually - continue on failure to maximize rollback
        foreach ($importedIds as $id) {
            try {
                DB::beginTransaction();
                $record = $modelClass::where('id', $id)
                    ->where('tenant_id', $import->tenant_id)
                    ->first();

                if ($record) {
                    $record->delete();
                    $deleted++;
                }
                DB::commit();
            } catch (\Throwable $e) {
                DB::rollBack();
                $failed++;
                $failedIds[] = $id;
                Log::warning('Auvo rollback failed for record', [
                    'import_id' => $import->id,
                    'record_id' => $id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Remove mappings for successfully deleted IDs
        $deletedIds = array_diff($importedIds, $failedIds);
        if (!empty($deletedIds)) {
            AuvoIdMapping::deleteMappingsForLocalIds(
                $import->entity_type,
                $deletedIds,
                $import->tenant_id
            );
        }

        $newStatus = empty($failedIds)
            ? AuvoImport::STATUS_ROLLED_BACK
            : AuvoImport::STATUS_DONE;

        $import->update([
            'status' => $newStatus,
            'imported_ids' => $failedIds ?: [],
        ]);

        return [
            'deleted' => $deleted,
            'failed' => $failed,
            'status' => $newStatus,
            'total' => count($importedIds),
        ];
    }

    // ─── Entity Importers ───────────────────────────────────

    private function importCustomers(AuvoImport $import, string $strategy): array
    {
        return $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            $auvoId = $mapped['_auvo_id'] ?? null;

            // Name obrigatório - fallback se vazio
            if (empty(trim((string) ($data['name'] ?? '')))) {
                $data['name'] = $auvoId ? "Cliente Auvo #{$auvoId}" : 'Cliente importado do Auvo';
            }

            // Email: extrair de array ou objeto
            if (isset($data['email'])) {
                $data['email'] = $this->extractFirstValue($data['email']);
            }

            // Phone: extrair de array ou objeto
            if (isset($data['phone'])) {
                $data['phone'] = $this->extractFirstValue($data['phone']);
            }

            // Document: normalizar (apenas dígitos)
            if (!empty($data['document'])) {
                $data['document'] = preg_replace('/\D/', '', (string) $data['document']);
            }

            // Tipo PF/PJ
            if (!empty($data['document'])) {
                $data['type'] = strlen($data['document']) <= 11 ? 'PF' : 'PJ';
            } else {
                $data['type'] = $data['type'] ?? 'PF';
            }

            // CEP: apenas dígitos
            if (!empty($data['address_zip'])) {
                $data['address_zip'] = preg_replace('/\D/', '', (string) $data['address_zip']);
            }

            // Status ativo
            $data['is_active'] = isset($data['is_active'])
                ? filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN)
                : true;

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

            // Equipment model has no 'name' field — use it in notes if present
            if (!empty($data['name'])) {
                $equipName = $data['name'];
                $data['notes'] = trim(($data['notes'] ?? '') . "\nNome Auvo: {$equipName}");
                unset($data['name']);
            }

            // Resolve customer via ID mapping
            $customerAuvoId = $mapped['_customer_auvo_id'] ?? null;
            if ($customerAuvoId) {
                $localCustomerId = AuvoIdMapping::findLocal('customers', (int) $customerAuvoId, $import->tenant_id);
                if ($localCustomerId) {
                    $data['customer_id'] = $localCustomerId;
                }
            }

            // Resolve category — store in 'category' field (string)
            if (!empty($mapped['_category_name'])) {
                $data['category'] = $mapped['_category_name'];
                $data['type'] = strtolower($mapped['_category_name']);
            }

            // Auto-generate code if missing
            if (empty($data['code'])) {
                $data['code'] = Equipment::generateCode($import->tenant_id);
            }

            // Default status
            if (empty($data['status'])) {
                $data['status'] = 'active';
            }

            return $data;
        }, function (array $data, int $tenantId) {
            if (!empty($data['serial_number'])) {
                return Equipment::where('tenant_id', $tenantId)
                    ->where('serial_number', $data['serial_number'])
                    ->first();
            }
            // Fallback: by code
            if (!empty($data['code'])) {
                return Equipment::where('tenant_id', $tenantId)
                    ->where('code', $data['code'])
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
        Log::info('Auvo importServices: starting', [
            'tenant_id' => $import->tenant_id,
            'strategy' => $strategy,
        ]);

        $result = $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            Log::debug('Auvo importServices: processing record', [
                'auvo_id' => $mapped['_auvo_id'] ?? null,
                'raw_fields' => array_keys($data),
            ]);

            if (isset($data['default_price']) && is_string($data['default_price'])) {
                $data['default_price'] = bcadd(str_replace(',', '.', $data['default_price']), '0', 2);
            }

            // Resolve category via ServiceCategory firstOrCreate
            $categoryName = $mapped['_category_name'] ?? null;
            if ($categoryName) {
                $category = \App\Models\ServiceCategory::firstOrCreate(
                    ['tenant_id' => $import->tenant_id, 'name' => $categoryName],
                    ['tenant_id' => $import->tenant_id, 'name' => $categoryName]
                );
                $data['category_id'] = $category->id;
            }

            // Default is_active to true if not provided
            $data['is_active'] = $data['is_active'] ?? true;

            // Convert duration (minutes) to integer
            if (isset($data['estimated_minutes'])) {
                $data['estimated_minutes'] = (int) $data['estimated_minutes'];
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

        Log::info('Auvo importServices: completed', $result);
        return $result;
    }

    private function importTasks(AuvoImport $import, string $strategy): array
    {
        return $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            // Map Auvo task fields to WorkOrder fields
            $woData = [
                'description' => $data['title'] ?? $data['description'] ?? 'Importado do Auvo',
                'internal_notes' => $data['notes'] ?? null,
                'priority' => $this->mapTaskPriority($data['priority'] ?? null),
                'status' => $this->mapTaskStatus($data['status'] ?? null),
                'received_at' => $data['scheduled_start'] ?? now(),
                'created_by' => $import->user_id,
            ];

            // Resolve customer via ID mapping
            $customerAuvoId = $mapped['_customer_auvo_id'] ?? null;
            if ($customerAuvoId) {
                $localCustomerId = AuvoIdMapping::findLocal('customers', (int) $customerAuvoId, $import->tenant_id);
                if ($localCustomerId) {
                    $woData['customer_id'] = $localCustomerId;
                }
            }

            // Resolve technician via ID mapping
            $techAuvoId = $mapped['_technician_auvo_id'] ?? null;
            if ($techAuvoId) {
                $localTechId = AuvoIdMapping::findLocal('users', (int) $techAuvoId, $import->tenant_id);
                if ($localTechId) {
                    $woData['assigned_to'] = $localTechId;
                }
            }

            // Dates
            if (!empty($data['scheduled_start'])) {
                $woData['received_at'] = $data['scheduled_start'];
            }
            if (!empty($data['completed_at'])) {
                $woData['completed_at'] = $data['completed_at'];
            }

            return $woData;
        }, function (array $data, int $tenantId) {
            // No natural unique key for tasks — rely on AuvoIdMapping
            return null;
        }, WorkOrder::class);
    }

    private function mapTaskStatus(?string $auvoStatus): string
    {
        // Auvo V2 task statuses: 1=Open, 2=InTransit, 3=CheckIn, 4=CheckOut, 5=Finished, 6=Paused
        return match ($auvoStatus) {
            '1', 'Open' => 'open',
            '2', 'InTransit' => 'in_progress',
            '3', 'CheckIn' => 'in_progress',
            '4', 'CheckOut' => 'in_progress',
            '5', 'Finished' => 'completed',
            '6', 'Paused' => 'on_hold',
            default => 'open',
        };
    }

    private function mapTaskPriority(?string $auvoPriority): string
    {
        return match ($auvoPriority) {
            '1', 'low', 'Low' => 'low',
            '2', 'normal', 'Normal' => 'normal',
            '3', 'high', 'High' => 'high',
            '4', 'urgent', 'Urgent' => 'urgent',
            default => 'normal',
        };
    }

    private function importExpenses(AuvoImport $import, string $strategy): array
    {
        return $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            // Set created_by from import user (required field)
            $data['created_by'] = $import->user_id;

            // Resolve user via mapping
            $userAuvoId = $mapped['_user_auvo_id'] ?? null;
            if ($userAuvoId) {
                $localUserId = AuvoIdMapping::findLocal('users', (int) $userAuvoId, $import->tenant_id);
                if ($localUserId) {
                    $data['created_by'] = $localUserId;
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

            // Resolve expense category — model uses expense_category_id
            if (!empty($mapped['_type_name'])) {
                $cat = ExpenseCategory::firstOrCreate(
                    ['tenant_id' => $import->tenant_id, 'name' => $mapped['_type_name']],
                    ['tenant_id' => $import->tenant_id, 'name' => $mapped['_type_name']]
                );
                $data['expense_category_id'] = $cat->id;
            }

            // Normalize amount
            if (isset($data['amount']) && is_string($data['amount'])) {
                $data['amount'] = bcadd(str_replace(',', '.', $data['amount']), '0', 2);
            }

            // Default status
            if (empty($data['status'])) {
                $data['status'] = 'approved';
            }

            return $data;
        }, function (array $data, int $tenantId) {
            // Expenses don't have a natural unique key — rely on AuvoIdMapping
            return null;
        }, Expense::class);
    }

    private function importQuotations(AuvoImport $import, string $strategy): array
    {
        Log::info('Auvo importQuotations: starting', [
            'tenant_id' => $import->tenant_id,
            'strategy' => $strategy,
        ]);

        $result = $this->importWithMapping($import, $strategy, function (array $mapped) use ($import) {
            $data = AuvoFieldMapper::stripMetadata($mapped);

            Log::debug('Auvo importQuotations: processing record', [
                'auvo_id' => $mapped['_auvo_id'] ?? null,
                'raw_fields' => array_keys($data),
            ]);

            // Use Auvo ID formatted as ORC-XXXXX to preserve traceability
            // nextNumber() will auto-continue from this via extractNumericSequence()
            $auvoId = (int) ($mapped['_auvo_id'] ?? 0);
            $data['quote_number'] = 'ORC-' . str_pad((string) $auvoId, 5, '0', STR_PAD_LEFT);

            // Map title to observations (Quote has no title field)
            if (!empty($data['title'])) {
                $data['observations'] = $data['title'];
                unset($data['title']);
            }

            // Map notes to internal_notes
            if (!empty($data['notes'])) {
                $data['internal_notes'] = $data['notes'];
                unset($data['notes']);
            }

            // Map Auvo observation field to internal_notes (append if notes already set)
            $auvoObservation = $mapped['_observation'] ?? null;
            if ($auvoObservation && empty($data['internal_notes'])) {
                $data['internal_notes'] = $auvoObservation;
            }

            // Resolve customer via AuvoIdMapping (required NOT NULL field)
            $customerAuvoId = $mapped['_customer_auvo_id'] ?? null;
            if ($customerAuvoId) {
                $localCustomerId = AuvoIdMapping::findLocal('customers', (int) $customerAuvoId, $import->tenant_id);
                if ($localCustomerId) {
                    $data['customer_id'] = $localCustomerId;
                }
            }

            // customer_id is required — skip record if not resolved (never assign to random customer)
            if (empty($data['customer_id'])) {
                Log::warning('Auvo importQuotations: skipping record — customer_id could not be resolved', [
                    'auvo_id' => $mapped['_auvo_id'] ?? null,
                    'customer_auvo_id' => $customerAuvoId,
                    'hint' => 'Import customers first to create AuvoIdMapping entries.',
                ]);
                return null; // will be skipped by importWithMapping
            }

            // seller_id is required — use import user as fallback
            $data['seller_id'] = $import->user_id;

            // Map Auvo status to QuoteStatus
            $data['status'] = $this->mapQuotationStatus($data['status'] ?? null);

            // Normalize total
            if (isset($data['total']) && is_string($data['total'])) {
                $data['total'] = bcadd(str_replace(',', '.', $data['total']), '0', 2);
            }

            // Parse valid_until date
            if (!empty($data['valid_until'])) {
                try {
                    $data['valid_until'] = \Carbon\Carbon::parse($data['valid_until'])->toDateString();
                } catch (\Throwable) {
                    unset($data['valid_until']);
                }
            }

            return $data;
        }, function (array $data, int $tenantId) {
            // Quotations have no natural unique key — rely on AuvoIdMapping
            return null;
        }, Quote::class);

        Log::info('Auvo importQuotations: completed', $result);
        return $result;
    }

    private function mapQuotationStatus(?string $auvoStatus): string
    {
        // Auvo quotation statuses vary — map to Kalibrium QuoteStatus values
        return match (strtolower(trim((string) $auvoStatus))) {
            'draft', 'rascunho' => 'draft',
            'sent', 'enviado' => 'sent',
            'approved', 'aprovado' => 'approved',
            'rejected', 'rejeitado', 'recusado' => 'rejected',
            'expired', 'expirado' => 'expired',
            'invoiced', 'faturado' => 'invoiced',
            default => 'draft',
        };
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
        $totalMapped = 0;
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
                    $mapping = AuvoIdMapping::mapOrCreate($entity, $auvoId, null, $import->tenant_id);
                    $mapping->update(['import_id' => $import->id]);
                }

                $totalMapped++;
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
            'total_imported' => 0, // No records created — mapping only
            'total_skipped' => $skipped,
            'total_errors' => $errors,
            'error_log' => $errorLog ?: null,
        ]);

        return [
            'total_fetched' => $totalFetched,
            'total_imported' => 0,
            'total_mapped' => $totalMapped,
            'total_updated' => 0,
            'total_skipped' => $skipped,
            'total_errors' => $errors,
            'mapping_only' => true,
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
                $existingMapped = null;

                // Check if already mapped
                if ($auvoId) {
                    $existingLocalId = AuvoIdMapping::findLocal($entity, $auvoId, $import->tenant_id);
                    if ($existingLocalId) {
                        if ($strategy === 'skip') {
                            $skipped++;
                            DB::commit();
                            continue;
                        } else {
                            // Pre-load existing record for update strategy via mapping 
                            // This ensures we don't recreate entities that don't have natural keys
                            $existingMapped = $modelClass::find($existingLocalId);
                        }
                    }
                }

                // Transform data
                $data = $transformer($mapped);

                // Transformer returning null means skip this record
                if ($data === null) {
                    $skipped++;
                    DB::commit();
                    continue;
                }

                $data['tenant_id'] = $import->tenant_id;

                // Check for duplicate by natural key (fallback if not mapped yet)
                $existing = $existingMapped ?? $duplicateFinder($data, $import->tenant_id);

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

        $result = [
            'total_fetched' => $totalFetched,
            'total_imported' => $inserted,
            'total_updated' => $updated,
            'total_skipped' => $skipped,
            'total_errors' => $errors,
        ];
        if (!empty($errorLog)) {
            $result['first_error'] = $errorLog[0]['message'] ?? 'Erro desconhecido';
            $result['error_log'] = array_slice($errorLog, 0, 5);
        }
        return $result;
    }

    /**
     * Extract scalar value from array (first element) or object (value/number key).
     */
    private function extractFirstValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
        if (!is_array($value)) {
            return (string) $value;
        }
        $first = $value[0] ?? null;
        if ($first === null) {
            return null;
        }
        if (is_string($first)) {
            return trim($first);
        }
        if (is_array($first)) {
            return $first['value'] ?? $first['number'] ?? $first['phone'] ?? $first['email'] ?? null;
        }
        return (string) $first;
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
            'tasks' => WorkOrder::class,
            'expenses' => Expense::class,
            'quotations' => Quote::class,
            default => null,
        };
    }
}
