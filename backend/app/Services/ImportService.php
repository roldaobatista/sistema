<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Import;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ImportService
{
    /**
     * Retorna campos disponíveis por entidade.
     */
    public function getFields(string $entity): array
    {
        return match ($entity) {
            Import::ENTITY_CUSTOMERS => Customer::getImportFields(),
            Import::ENTITY_PRODUCTS => Product::getImportFields(),
            Import::ENTITY_SERVICES => Service::getImportFields(),
            Import::ENTITY_EQUIPMENTS => Equipment::getImportFields(),
            Import::ENTITY_SUPPLIERS => Supplier::getImportFields(),
            default => [],
        };
    }

    /**
     * Gera CSV de exemplo para uma entidade.
     */
    public function generateSampleCsv(string $entity): string
    {
        $fields = $this->getFields($entity);
        if (empty($fields)) return '';

        $headers = array_map(fn($f) => $f['label'], $fields);
        $keys = array_map(fn($f) => $f['key'], $fields);

        $sampleData = $this->getSampleData($entity, $keys);

        $output = fopen('php://temp', 'r+');
        // BOM for Excel UTF-8
        fwrite($output, "\xEF\xBB\xBF");
        fputcsv($output, $headers, ';');

        foreach ($sampleData as $row) {
            $line = [];
            foreach ($keys as $key) {
                $line[] = $row[$key] ?? '';
            }
            fputcsv($output, $line, ';');
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }

    private function getSampleData(string $entity, array $keys): array
    {
        return match ($entity) {
            Import::ENTITY_CUSTOMERS => [
                ['name' => 'Empresa Exemplo Ltda', 'document' => '12.345.678/0001-90', 'type' => 'PJ', 'email' => 'contato@exemplo.com', 'phone' => '(11) 99999-0001', 'phone2' => '', 'address_zip' => '01001-000', 'address_street' => 'Rua das Flores', 'address_number' => '123', 'address_complement' => 'Sala 1', 'address_neighborhood' => 'Centro', 'address_city' => 'São Paulo', 'address_state' => 'SP', 'notes' => 'Cliente VIP'],
                ['name' => 'João da Silva', 'document' => '123.456.789-00', 'type' => 'PF', 'email' => 'joao@email.com', 'phone' => '(11) 98888-0002', 'phone2' => '', 'address_zip' => '04001-000', 'address_street' => 'Av Brasil', 'address_number' => '456', 'address_complement' => '', 'address_neighborhood' => 'Jardim', 'address_city' => 'São Paulo', 'address_state' => 'SP', 'notes' => ''],
            ],
            Import::ENTITY_PRODUCTS => [
                ['code' => 'PROD-001', 'name' => 'Termômetro Digital', 'sell_price' => '150,00', 'category_name' => 'Instrumentos', 'description' => 'Termômetro digital de precisão', 'unit' => 'UN', 'cost_price' => '80,00', 'stock_qty' => '50', 'stock_min' => '10'],
                ['code' => 'PROD-002', 'name' => 'Balança Analítica', 'sell_price' => '2500,00', 'category_name' => 'Equipamentos', 'description' => 'Balança analítica 0.001g', 'unit' => 'UN', 'cost_price' => '1200,00', 'stock_qty' => '5', 'stock_min' => '2'],
            ],
            Import::ENTITY_SERVICES => [
                ['code' => 'SRV-001', 'name' => 'Calibração de Termômetro', 'default_price' => '120,00', 'category_name' => 'Calibração', 'description' => 'Calibração completa', 'estimated_minutes' => '60'],
                ['code' => 'SRV-002', 'name' => 'Manutenção Preventiva', 'default_price' => '250,00', 'category_name' => 'Manutenção', 'description' => 'Manutenção preventiva semestral', 'estimated_minutes' => '120'],
            ],
            Import::ENTITY_EQUIPMENTS => [
                ['serial_number' => 'SN-2024-001', 'customer_document' => '12.345.678/0001-90', 'type' => 'termometro', 'brand' => 'Fluke', 'model' => 'T200', 'notes' => 'Equipamento de laboratório'],
                ['serial_number' => 'SN-2024-002', 'customer_document' => '123.456.789-00', 'type' => 'balanca_analitica', 'brand' => 'Mettler', 'model' => 'XS105', 'notes' => ''],
            ],
            Import::ENTITY_SUPPLIERS => [
                ['name' => 'Fornecedor ABC Ltda', 'document' => '98.765.432/0001-10', 'type' => 'PJ', 'trade_name' => 'ABC Suprimentos', 'email' => 'vendas@abc.com', 'phone' => '(11) 3333-4444', 'phone2' => '', 'address_zip' => '01001-000', 'address_street' => 'Rua Industrial', 'address_number' => '789', 'address_complement' => 'Galpão 2', 'address_neighborhood' => 'Distrito Industrial', 'address_city' => 'Guarulhos', 'address_state' => 'SP', 'notes' => 'Fornecedor principal'],
                ['name' => 'Maria Pereira ME', 'document' => '987.654.321-00', 'type' => 'PF', 'trade_name' => '', 'email' => 'maria@email.com', 'phone' => '(21) 99999-5555', 'phone2' => '', 'address_zip' => '20001-000', 'address_street' => 'Rua do Comércio', 'address_number' => '50', 'address_complement' => '', 'address_neighborhood' => 'Centro', 'address_city' => 'Rio de Janeiro', 'address_state' => 'RJ', 'notes' => ''],
            ],
            default => [],
        };
    }

    /**
     * Exporta dados de uma entidade como CSV.
     */
    public function exportEntityData(string $entity, int $tenantId): string
    {
        $fields = $this->getFields($entity);
        if (empty($fields)) return '';

        $modelClass = match ($entity) {
            Import::ENTITY_CUSTOMERS => Customer::class,
            Import::ENTITY_PRODUCTS => Product::class,
            Import::ENTITY_SERVICES => Service::class,
            Import::ENTITY_EQUIPMENTS => Equipment::class,
            Import::ENTITY_SUPPLIERS => Supplier::class,
            default => null,
        };

        if (!$modelClass) return '';

        $headers = array_map(fn($f) => $f['label'], $fields);
        $keys = array_map(fn($f) => $f['key'], $fields);

        $eagerLoads = $this->getExportEagerLoads($entity);

        $output = fopen('php://temp', 'r+');
        fwrite($output, "\xEF\xBB\xBF"); // BOM for Excel UTF-8
        fputcsv($output, $headers, ';');

        // I4: Chunk streaming para evitar memory overflow
        $query = $modelClass::where('tenant_id', $tenantId);
        if (!empty($eagerLoads)) {
            $query->with($eagerLoads);
        }
        $query->chunk(500, function ($records) use ($output, $keys, $entity) {
            foreach ($records as $record) {
                $line = [];
                foreach ($keys as $key) {
                    $line[] = $this->resolveExportField($record, $key, $entity);
                }
                fputcsv($output, $line, ';');
            }
        });

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }

    /**
     * Conta linhas de dados em um CSV (exclui header).
     */
    public function countCsvRows(string $fullPath): int
    {
        $handle = fopen($fullPath, 'r');
        if (!$handle) return 0;

        $count = -1; // Desconta header
        while (fgets($handle) !== false) {
            $count++;
        }
        fclose($handle);

        return max(0, $count);
    }

    /**
     * Exporta log de erros como CSV.
     */
    public function exportErrorCsv(Import $import): string
    {
        $errorLog = $import->error_log ?? [];
        if (empty($errorLog)) return '';

        $output = fopen('php://temp', 'r+');
        fwrite($output, "\xEF\xBB\xBF");
        fputcsv($output, ['Linha', 'Erro', 'Dados'], ';');

        foreach ($errorLog as $error) {
            $dataStr = '';
            if (!empty($error['data'])) {
                $dataStr = collect($error['data'])->map(fn($v, $k) => "$k: $v")->implode(' | ');
            }
            fputcsv($output, [
                $error['line'] ?? '?',
                $error['message'] ?? 'Erro desconhecido',
                $dataStr,
            ], ';');
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }

    /**
     * Desfaz uma importação deletando os registros criados.
     */
    public function rollbackImport(Import $import): array
    {
        $importedIds = $import->imported_ids ?? [];
        if (empty($importedIds)) {
            throw new \Exception('Nenhum registro para desfazer. Esta importação não possui IDs rastreados.');
        }

        $modelClass = match ($import->entity_type) {
            Import::ENTITY_CUSTOMERS => Customer::class,
            Import::ENTITY_PRODUCTS => Product::class,
            Import::ENTITY_SERVICES => Service::class,
            Import::ENTITY_EQUIPMENTS => Equipment::class,
            Import::ENTITY_SUPPLIERS => Supplier::class,
            default => null,
        };

        if (!$modelClass) {
            throw new \Exception('Tipo de entidade inválido para rollback.');
        }

        $deleted = 0;
        $failed = 0;
        $failedIds = [];

        DB::beginTransaction();

        try {
            foreach ($importedIds as $id) {
                $record = $modelClass::where('id', $id)
                    ->where('tenant_id', $import->tenant_id)
                    ->first();

                if ($record) {
                    try {
                        // I2: Usar delete() para respeitar soft-deletes
                        $record->delete();
                        $deleted++;
                    } catch (\Throwable $e) {
                        $failed++;
                        $failedIds[] = $id;
                        Log::warning('Rollback could not delete record', [
                            'import_id' => $import->id,
                            'record_id' => $id,
                            'entity' => $import->entity_type,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }

            $import->update([
                'status' => $failed === 0 ? Import::STATUS_ROLLED_BACK : Import::STATUS_PARTIALLY_ROLLED_BACK,
                'imported_ids' => $failedIds,
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return [
            'deleted' => $deleted,
            'failed' => $failed,
            'total' => count($importedIds),
        ];
    }

    /**
     * Processa o upload e retorna metadados.
     */
    public function processUpload($file, string $entityType): array
    {
        $path = $file->store('imports', 'local');
        $fullPath = Storage::disk('local')->path($path);

        // Detectar encoding e converter para UTF-8 se necessário
        $content = file_get_contents($fullPath);
        $encoding = mb_detect_encoding($content, ['UTF-8', 'ISO-8859-1', 'Windows-1252'], true) ?: 'UTF-8';

        if ($encoding !== 'UTF-8') {
            $content = mb_convert_encoding($content, 'UTF-8', $encoding);
            file_put_contents($fullPath, $content);
        }

        // Detectar separador
        $firstLine = strtok($content, "\n");
        $separators = [';' => 0, ',' => 0, "\t" => 0];
        foreach ($separators as $sep => &$count) {
            $count = substr_count($firstLine, $sep);
        }
        arsort($separators);
        $separator = array_key_first($separators);

        // Ler headers e contar linhas
        $handle = fopen($fullPath, 'r');
        $headers = fgetcsv($handle, 0, $separator);
        $headers = array_map(fn($h) => trim($h, "\u{FEFF} \t\n\r\0\x0B"), $headers ?: []);

        $totalRows = 0;
        while (fgetcsv($handle, 0, $separator) !== false) {
            $totalRows++;
        }
        fclose($handle);

        return [
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'encoding' => $encoding,
            'separator' => $separator === "\t" ? 'tab' : $separator,
            'headers' => $headers,
            'total_rows' => $totalRows,
            'entity_type' => $entityType,
            'available_fields' => $this->getFields($entityType),
        ];
    }

    /**
     * Gera preview da importação.
     */
    public function generatePreview(string $filePath, string $entity, array $mapping, string $separator, int $limit, int $tenantId): array
    {
        $fullPath = Storage::disk('local')->path($filePath);
        if ($separator === 'tab') $separator = "\t";

        $handle = fopen($fullPath, 'r');
        $headers = fgetcsv($handle, 0, $separator);
        $headers = array_map(fn($h) => trim($h, "\u{FEFF} \t\n\r\0\x0B"), $headers ?: []);

        $rows = [];
        $lineNum = 1;

        while (($line = fgetcsv($handle, 0, $separator)) !== false && count($rows) < $limit) {
            $lineNum++;
            $mapped = $this->mapRow($headers, $line, $mapping);
            $validation = $this->validateRow($mapped, $entity, $tenantId);

            $rows[] = [
                'line' => $lineNum,
                'data' => $mapped,
                'status' => $validation['status'],
                'messages' => $validation['messages'],
            ];
        }
        fclose($handle);

        $stats = [
            'valid' => count(array_filter($rows, fn($r) => $r['status'] === 'valid')),
            'warnings' => count(array_filter($rows, fn($r) => $r['status'] === 'warning')),
            'errors' => count(array_filter($rows, fn($r) => $r['status'] === 'error')),
        ];

        return ['rows' => $rows, 'stats' => $stats];
    }

    /**
     * Executa a importação completa.
     */
    public function executeImport(Import $import): void
    {
        $fullPath = Storage::disk('local')->path($import->file_name);

        if (!file_exists($fullPath)) {
            $altPath = str_starts_with($import->file_name, 'imports/')
                ? $import->file_name
                : 'imports/' . $import->file_name;
            $altFullPath = Storage::disk('local')->path($altPath);
            if (file_exists($altFullPath)) {
                $fullPath = $altFullPath;
            } else {
                throw new \Exception('Arquivo de importação não encontrado: ' . $import->file_name);
            }
        }

        $separator = $import->separator ?? $this->detectSeparator($fullPath);
        if ($separator === 'tab') $separator = "\t";

        $handle = fopen($fullPath, 'r');
        $headers = fgetcsv($handle, 0, $separator);
        $headers = array_map(fn($h) => trim($h, "\u{FEFF} \t\n\r\0\x0B"), $headers ?: []);

        $inserted = 0;
        $updated = 0;
        $skipped = 0;
        $errors = 0;
        $errorLog = [];
        $importedIds = [];
        $lineNum = 1;

        while (($line = fgetcsv($handle, 0, $separator)) !== false) {
            $lineNum++;

            try {
                DB::beginTransaction();

                $mapped = $this->mapRow($headers, $line, $import->mapping);
                $validation = $this->validateRow($mapped, $import->entity_type, $import->tenant_id);

                if ($validation['status'] === 'error') {
                    throw new \Exception(implode('; ', $validation['messages']));
                }

                $result = $this->importRow($mapped, $import->entity_type, $import->tenant_id, $import->duplicate_strategy);

                if (is_array($result)) {
                    // importRow returned ['action', id]
                    match ($result[0]) {
                        'inserted' => $inserted++,
                        'updated' => $updated++,
                        'skipped' => $skipped++,
                        default => $errors++,
                    };
                    if ($result[0] === 'inserted' && $result[1]) {
                        $importedIds[] = $result[1];
                    }
                } else {
                    match ($result) {
                        'inserted' => $inserted++,
                        'updated' => $updated++,
                        'skipped' => $skipped++,
                        default => $errors++,
                    };
                }

                DB::commit();
            } catch (\Throwable $e) {
                DB::rollBack();
                $errors++;

                Log::warning('Import row error', [
                    'import_id' => $import->id,
                    'line' => $lineNum,
                    'error' => $e->getMessage(),
                ]);

                $rowData = [];
                if (count($headers) === count($line)) {
                    $rowData = array_combine($headers, $line);
                }

                $errorLog[] = [
                    'line' => $lineNum,
                    'message' => $e->getMessage(),
                    'data' => $rowData,
                ];
            }
        }
        fclose($handle);

        $finalStatus = ($errors > 0 && $inserted === 0 && $updated === 0)
            ? Import::STATUS_FAILED
            : Import::STATUS_DONE;

        $import->update([
            'total_rows' => $lineNum - 1,
            'inserted' => $inserted,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => $errors,
            'error_log' => $errorLog,
            'imported_ids' => $importedIds,
            'status' => $finalStatus,
        ]);

        // Cleanup: remove uploaded file after processing
        try {
            Storage::disk('local')->delete($import->file_name);
        } catch (\Throwable $e) {
            Log::warning('Could not cleanup import file', ['file' => $import->file_name, 'error' => $e->getMessage()]);
        }
    }

    private function detectSeparator(string $fullPath): string
    {
        $handle = fopen($fullPath, 'r');
        $line = fgets($handle);
        fclose($handle);

        if (!$line) return ';';

        $separators = [';' => 0, ',' => 0, "\t" => 0];
        foreach ($separators as $sep => &$count) {
            $count = substr_count($line, $sep);
        }
        arsort($separators);
        return array_key_first($separators);
    }

    private function mapRow(array $headers, array $line, array $mapping): array
    {
        $mapped = [];
        foreach ($mapping as $systemField => $fileColumn) {
            if (!$fileColumn) continue;
            $colIndex = array_search($fileColumn, $headers);
            if ($colIndex !== false && isset($line[$colIndex])) {
                $mapped[$systemField] = trim($line[$colIndex]);
            }
        }
        return $mapped;
    }

    private function validateRow(array $data, string $entity, int $tenantId): array
    {
        $messages = [];
        $status = 'valid';
        $fields = $this->getFields($entity);
        $requiredFields = array_filter($fields, fn($f) => $f['required']);

        foreach ($requiredFields as $field) {
            if (empty($data[$field['key']])) {
                $messages[] = "Campo '{$field['label']}' é obrigatório";
                $status = 'error';
            }
        }

        if ($status === 'error') return compact('status', 'messages');

        // Check duplicates
        $duplicate = $this->findDuplicate($data, $entity, $tenantId);
        if ($duplicate) {
            $messages[] = "Registro duplicado ignorado (ID: {$duplicate->id})";
            $status = 'warning';
        }

        // F1: Document validation com dígitos verificadores (customers + suppliers)
        if (in_array($entity, [Import::ENTITY_CUSTOMERS, Import::ENTITY_SUPPLIERS]) && !empty($data['document'])) {
            $doc = preg_replace('/\D/', '', $data['document']);
            if (!$this->validateCpfCnpj($doc)) {
                $messages[] = 'CPF/CNPJ inválido (verificar documento)';
                if ($status === 'valid') $status = 'warning';
            }
        }

        // Email validation
        if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $messages[] = "E-mail inválido: '{$data['email']}'";
            $status = 'error';
        }

        // Phone validation (Brazilian format)
        if (in_array($entity, [Import::ENTITY_CUSTOMERS, Import::ENTITY_SUPPLIERS])) {
            foreach (['phone', 'phone2'] as $phoneKey) {
                if (!empty($data[$phoneKey])) {
                    $digits = preg_replace('/\D/', '', $data[$phoneKey]);
                    if (strlen($digits) < 10 || strlen($digits) > 11) {
                        $messages[] = "Telefone '{$data[$phoneKey]}' inválido (esperado 10 ou 11 dígitos)";
                        if ($status === 'valid') $status = 'warning';
                    }
                }
            }
        }

        // UF validation
        if (!empty($data['address_state'])) {
            $validUfs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
            if (!in_array(strtoupper($data['address_state']), $validUfs)) {
                $messages[] = "UF inválida: '{$data['address_state']}'";
                if ($status === 'valid') $status = 'warning';
            }
        }

        // Numeric validation
        $numericKeys = ['sell_price', 'cost_price', 'stock_qty', 'stock_min', 'default_price', 'annual_revenue_estimate', 'estimated_minutes'];
        foreach ($numericKeys as $nk) {
            if (!empty($data[$nk]) && is_string($data[$nk])) {
                $normalized = str_replace(['.', ','], ['', '.'], $data[$nk]);
                if (!is_numeric($normalized)) {
                    $fieldDef = collect($fields)->firstWhere('key', $nk);
                    $label = $fieldDef['label'] ?? $nk;
                    $messages[] = "Campo '{$label}' contém valor não numérico: '{$data[$nk]}'";
                    $status = 'error';
                }
            }
        }

        return compact('status', 'messages');
    }

    private function findDuplicate(array $data, string $entity, int $tenantId): ?object
    {
        return match ($entity) {
            Import::ENTITY_CUSTOMERS => !empty($data['document'])
                ? Customer::where('tenant_id', $tenantId)->where('document', preg_replace('/\D/', '', $data['document']))->first()
                : null,
            Import::ENTITY_PRODUCTS => !empty($data['code'])
                ? Product::where('tenant_id', $tenantId)->where('code', $data['code'])->first()
                : null,
            Import::ENTITY_SERVICES => !empty($data['code'])
                ? Service::where('tenant_id', $tenantId)->where('code', $data['code'])->first()
                : null,
            Import::ENTITY_EQUIPMENTS => !empty($data['serial_number'])
                ? Equipment::where('tenant_id', $tenantId)->where('serial_number', $data['serial_number'])->first()
                : null,
            Import::ENTITY_SUPPLIERS => !empty($data['document'])
                ? Supplier::where('tenant_id', $tenantId)->where('document', preg_replace('/\D/', '', $data['document']))->first()
                : null,
            default => null,
        };
    }

    private function importRow(array $data, string $entity, int $tenantId, string $strategy): array
    {
        $existing = $this->findDuplicate($data, $entity, $tenantId);

        if ($existing) {
            if ($strategy === Import::STRATEGY_SKIP) return ['skipped', null];
            if ($strategy === Import::STRATEGY_UPDATE) {
                $ok = $this->updateExisting($existing, $data, $entity, $tenantId);
                return [$ok ? 'updated' : 'skipped', null];
            }
            // Create strategy falls through
        }

        $id = $this->createNew($data, $entity, $tenantId);
        return [$id ? 'inserted' : 'skipped', $id];
    }

    private function createNew(array $data, string $entity, int $tenantId): ?int
    {
        $data['tenant_id'] = $tenantId;

        $modelClass = match($entity) {
            Import::ENTITY_CUSTOMERS => Customer::class,
            Import::ENTITY_PRODUCTS => Product::class,
            Import::ENTITY_SERVICES => Service::class,
            Import::ENTITY_EQUIPMENTS => Equipment::class,
            Import::ENTITY_SUPPLIERS => Supplier::class,
            default => null
        };

        if (!$modelClass) return null;

        $instance = new $modelClass;

        if (in_array('is_active', $instance->getFillable())) {
            $data['is_active'] = true;
        }

        $this->normalizeData($data, $entity);
        $this->resolveReferences($data, $entity, $tenantId);

        // Auto-detect PF/PJ
        if (in_array($entity, [Import::ENTITY_CUSTOMERS, Import::ENTITY_SUPPLIERS]) && empty($data['type']) && !empty($data['document'])) {
            $docLen = strlen(preg_replace('/\D/', '', $data['document']));
            $data['type'] = $docLen <= 11 ? 'PF' : 'PJ';
        }

        // Equipment Code Auto-gen
        if ($entity === Import::ENTITY_EQUIPMENTS && empty($data['code'])) {
            $data['code'] = Equipment::generateCode($tenantId);
        }

        $fillableData = array_intersect_key($data, array_flip($instance->getFillable()));
        $created = $modelClass::create($fillableData);
        return $created->id;
    }

    private function updateExisting(object $record, array $data, string $entity, int $tenantId): bool
    {
        $this->normalizeData($data, $entity);
        $this->resolveReferences($data, $entity, $tenantId);

        // Remove empty values to avoid overwriting with null
        $data = array_filter($data, fn($v) => $v !== '' && $v !== null);

        // Remove tenant_id from update
        unset($data['tenant_id']);

        $fillableData = array_intersect_key($data, array_flip($record->getFillable()));
        $record->update($fillableData);
        return true;
    }

    private function normalizeData(array &$data, string $entity): void
    {
        // C1: Normalização numérica segura (sem float cast direto para money)
        $moneyKeys = ['sell_price', 'cost_price', 'default_price', 'annual_revenue_estimate'];
        $intKeys = ['stock_qty', 'stock_min', 'estimated_minutes'];
        $numericKeys = array_merge($moneyKeys, $intKeys);

        foreach ($data as $key => $value) {
            if (in_array($key, $numericKeys) && is_string($value)) {
                if (str_contains($value, ',')) {
                    $value = str_replace('.', '', $value);
                    $value = str_replace(',', '.', $value);
                }
                if (in_array($key, $intKeys)) {
                    $data[$key] = (int) $value;
                } else {
                    // Money: usar bcadd para precisão
                    $data[$key] = bcadd($value, '0', 2);
                }
            }
        }

        // Document
        if (isset($data['document'])) {
            $data['document'] = preg_replace('/\D/', '', $data['document']);
        }

        // Address ZIP (CEP)
        if (isset($data['address_zip'])) {
            $data['address_zip'] = preg_replace('/\D/', '', $data['address_zip']);
        }
    }

    private function resolveReferences(array &$data, string $entity, int $tenantId): void
    {
        if (!empty($data['category_name'])) {
            $catModel = match($entity) {
                Import::ENTITY_PRODUCTS => ProductCategory::class,
                Import::ENTITY_SERVICES => ServiceCategory::class,
                default => null
            };

            if ($catModel) {
                $cat = $catModel::firstOrCreate(
                    ['tenant_id' => $tenantId, 'name' => $data['category_name']],
                    ['tenant_id' => $tenantId, 'name' => $data['category_name']]
                );
                $data['category_id'] = $cat->id;
            }
            unset($data['category_name']);
        }

        if ($entity === Import::ENTITY_EQUIPMENTS && !empty($data['customer_document'])) {
            $doc = preg_replace('/\D/', '', $data['customer_document']);
            $customer = Customer::where('tenant_id', $tenantId)->where('document', $doc)->first();
            if ($customer) {
                $data['customer_id'] = $customer->id;
            } else {
                throw new \Exception("Cliente com documento $doc não encontrado");
            }
            unset($data['customer_document']);
        }
    }

    private function getExportEagerLoads(string $entity): array
    {
        return match ($entity) {
            Import::ENTITY_PRODUCTS => ['category'],
            Import::ENTITY_SERVICES => ['category'],
            Import::ENTITY_EQUIPMENTS => ['customer'],
            default => [],
        };
    }

    private function resolveExportField(object $record, string $key, string $entity): string
    {
        // Virtual fields that need relationship resolution
        if ($key === 'category_name') {
            return $record->category?->name ?? '';
        }

        if ($key === 'customer_document' && $entity === Import::ENTITY_EQUIPMENTS) {
            return $record->customer?->document ?? '';
        }

        // Numeric fields — format for Brazilian CSV
        $moneyKeys = ['sell_price', 'cost_price', 'default_price'];
        if (in_array($key, $moneyKeys) && $record->{$key} !== null) {
            return number_format((float) $record->{$key}, 2, ',', '.');
        }

        return (string) ($record->{$key} ?? '');
    }

    /**
     * F1: Valida CPF ou CNPJ com dígitos verificadores.
     */
    private function validateCpfCnpj(string $doc): bool
    {
        $doc = preg_replace('/\D/', '', $doc);

        if (strlen($doc) === 11) {
            return $this->validateCpf($doc);
        }

        if (strlen($doc) === 14) {
            return $this->validateCnpj($doc);
        }

        return false;
    }

    private function validateCpf(string $cpf): bool
    {
        if (preg_match('/^(\d)\1{10}$/', $cpf)) return false;

        for ($t = 9; $t < 11; $t++) {
            $d = 0;
            for ($c = 0; $c < $t; $c++) {
                $d += (int) $cpf[$c] * (($t + 1) - $c);
            }
            $d = ((10 * $d) % 11) % 10;
            if ((int) $cpf[$c] !== $d) return false;
        }

        return true;
    }

    private function validateCnpj(string $cnpj): bool
    {
        if (preg_match('/^(\d)\1{13}$/', $cnpj)) return false;

        $length = strlen($cnpj) - 2;
        $numbers = substr($cnpj, 0, $length);
        $digits = substr($cnpj, $length);

        $sum = 0;
        $pos = $length - 7;
        for ($i = $length; $i >= 1; $i--) {
            $sum += (int) $numbers[$length - $i] * $pos--;
            if ($pos < 2) $pos = 9;
        }
        $result = $sum % 11 < 2 ? 0 : 11 - ($sum % 11);
        if ((int) $digits[0] !== $result) return false;

        $length++;
        $numbers = substr($cnpj, 0, $length);
        $sum = 0;
        $pos = $length - 7;
        for ($i = $length; $i >= 1; $i--) {
            $sum += (int) $numbers[$length - $i] * $pos--;
            if ($pos < 2) $pos = 9;
        }
        $result = $sum % 11 < 2 ? 0 : 11 - ($sum % 11);
        if ((int) $digits[1] !== $result) return false;

        return true;
    }
}
