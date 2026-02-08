<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Import;
use App\Models\ImportTemplate;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Service;
use App\Models\Equipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ImportController extends Controller
{
    /**
     * Campos disponíveis por entidade para mapeamento.
     */
    private array $entityFields = [
        'customers' => [
            ['key' => 'name', 'label' => 'Nome', 'required' => true],
            ['key' => 'document', 'label' => 'CPF/CNPJ', 'required' => true],
            ['key' => 'type', 'label' => 'Tipo (PF/PJ)', 'required' => false],
            ['key' => 'email', 'label' => 'E-mail', 'required' => false],
            ['key' => 'phone', 'label' => 'Telefone', 'required' => false],
            ['key' => 'phone2', 'label' => 'Telefone 2', 'required' => false],
            ['key' => 'address_zip', 'label' => 'CEP', 'required' => false],
            ['key' => 'address_street', 'label' => 'Rua', 'required' => false],
            ['key' => 'address_number', 'label' => 'Número', 'required' => false],
            ['key' => 'address_complement', 'label' => 'Complemento', 'required' => false],
            ['key' => 'address_neighborhood', 'label' => 'Bairro', 'required' => false],
            ['key' => 'address_city', 'label' => 'Cidade', 'required' => false],
            ['key' => 'address_state', 'label' => 'UF', 'required' => false],
            ['key' => 'notes', 'label' => 'Observações', 'required' => false],
        ],
        'products' => [
            ['key' => 'code', 'label' => 'Código', 'required' => true],
            ['key' => 'name', 'label' => 'Nome', 'required' => true],
            ['key' => 'sell_price', 'label' => 'Preço Venda', 'required' => true],
            ['key' => 'category_name', 'label' => 'Categoria', 'required' => false],
            ['key' => 'description', 'label' => 'Descrição', 'required' => false],
            ['key' => 'unit', 'label' => 'Unidade', 'required' => false],
            ['key' => 'cost_price', 'label' => 'Preço Custo', 'required' => false],
            ['key' => 'stock_qty', 'label' => 'Estoque Atual', 'required' => false],
            ['key' => 'stock_min', 'label' => 'Estoque Mínimo', 'required' => false],
        ],
        'services' => [
            ['key' => 'code', 'label' => 'Código', 'required' => true],
            ['key' => 'name', 'label' => 'Nome', 'required' => true],
            ['key' => 'default_price', 'label' => 'Preço', 'required' => true],
            ['key' => 'category_name', 'label' => 'Categoria', 'required' => false],
            ['key' => 'description', 'label' => 'Descrição', 'required' => false],
            ['key' => 'estimated_minutes', 'label' => 'Tempo Estimado (min)', 'required' => false],
        ],
        'equipments' => [
            ['key' => 'serial_number', 'label' => 'Nº Série', 'required' => true],
            ['key' => 'customer_document', 'label' => 'CPF/CNPJ Cliente', 'required' => true],
            ['key' => 'type', 'label' => 'Tipo', 'required' => false],
            ['key' => 'brand', 'label' => 'Marca', 'required' => false],
            ['key' => 'model', 'label' => 'Modelo', 'required' => false],
            ['key' => 'notes', 'label' => 'Observações', 'required' => false],
        ],
    ];

    /**
     * Retorna campos disponíveis por entidade.
     */
    public function fields(string $entity): JsonResponse
    {
        if (!isset($this->entityFields[$entity])) {
            return response()->json(['message' => 'Entidade inválida'], 422);
        }

        return response()->json(['fields' => $this->entityFields[$entity]]);
    }

    /**
     * Upload do arquivo e retorna headers detectados.
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt,xlsx|max:10240',
            'entity_type' => 'required|in:customers,products,services,equipments',
        ]);

        $file = $request->file('file');
        $entity = $request->input('entity_type');
        $path = $file->store('imports', 'local');
        $fullPath = storage_path('app/' . $path);

        // Detectar encoding e ler headers
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

        // Parse headers
        $handle = fopen($fullPath, 'r');
        $headers = fgetcsv($handle, 0, $separator);
        $headers = array_map('trim', $headers);

        // Contar linhas
        $totalRows = 0;
        while (fgetcsv($handle, 0, $separator) !== false) {
            $totalRows++;
        }
        fclose($handle);

        return response()->json([
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'encoding' => $encoding,
            'separator' => $separator === "\t" ? 'tab' : $separator,
            'headers' => $headers,
            'total_rows' => $totalRows,
            'entity_type' => $entity,
            'available_fields' => $this->entityFields[$entity],
        ]);
    }

    /**
     * Preview: valida as primeiras N linhas com o mapeamento fornecido.
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file_path' => 'required|string',
            'entity_type' => 'required|in:customers,products,services,equipments',
            'mapping' => 'required|array',
            'separator' => 'nullable|string',
            'limit' => 'nullable|integer|min:5|max:100',
        ]);

        $fullPath = storage_path('app/' . $request->input('file_path'));
        if (!file_exists($fullPath)) {
            return response()->json(['message' => 'Arquivo não encontrado'], 404);
        }

        $separator = $request->input('separator', ';');
        if ($separator === 'tab') $separator = "\t";
        $mapping = $request->input('mapping');
        $entity = $request->input('entity_type');
        $limit = $request->input('limit', 20);
        $tenantId = $request->user()->tenant_id;

        $handle = fopen($fullPath, 'r');
        $fileHeaders = fgetcsv($handle, 0, $separator);
        $fileHeaders = array_map('trim', $fileHeaders);

        $rows = [];
        $lineNum = 1;
        while (($line = fgetcsv($handle, 0, $separator)) !== false && count($rows) < $limit) {
            $lineNum++;
            $mapped = $this->mapRow($fileHeaders, $line, $mapping);
            $validation = $this->validateRow($mapped, $entity, $tenantId);
            $rows[] = [
                'line' => $lineNum,
                'data' => $mapped,
                'status' => $validation['status'], // valid, warning, error
                'messages' => $validation['messages'],
            ];
        }
        fclose($handle);

        $stats = [
            'valid' => count(array_filter($rows, fn($r) => $r['status'] === 'valid')),
            'warnings' => count(array_filter($rows, fn($r) => $r['status'] === 'warning')),
            'errors' => count(array_filter($rows, fn($r) => $r['status'] === 'error')),
        ];

        return response()->json(['rows' => $rows, 'stats' => $stats]);
    }

    /**
     * Executa a importação completa.
     */
    public function execute(Request $request): JsonResponse
    {
        $request->validate([
            'file_path' => 'required|string',
            'entity_type' => 'required|in:customers,products,services,equipments',
            'mapping' => 'required|array',
            'separator' => 'nullable|string',
            'duplicate_strategy' => 'nullable|in:skip,update,create',
        ]);

        $fullPath = storage_path('app/' . $request->input('file_path'));
        if (!file_exists($fullPath)) {
            return response()->json(['message' => 'Arquivo não encontrado'], 404);
        }

        $separator = $request->input('separator', ';');
        if ($separator === 'tab') $separator = "\t";
        $mapping = $request->input('mapping');
        $entity = $request->input('entity_type');
        $strategy = $request->input('duplicate_strategy', 'skip');
        $tenantId = $request->user()->tenant_id;
        $userId = $request->user()->id;

        // Criar registro de importação
        $import = Import::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'entity_type' => $entity,
            'file_name' => basename($fullPath),
            'mapping' => $mapping,
            'duplicate_strategy' => $strategy,
            'status' => 'processing',
        ]);

        $handle = fopen($fullPath, 'r');
        $fileHeaders = fgetcsv($handle, 0, $separator);
        $fileHeaders = array_map('trim', $fileHeaders);

        $inserted = 0;
        $updated = 0;
        $skipped = 0;
        $errors = 0;
        $errorLog = [];
        $totalRows = 0;
        $lineNum = 1;

        while (($line = fgetcsv($handle, 0, $separator)) !== false) {
            $lineNum++;
            $totalRows++;

            try {
                $mapped = $this->mapRow($fileHeaders, $line, $mapping);
                $result = $this->importRow($mapped, $entity, $tenantId, $strategy);

                match ($result) {
                    'inserted' => $inserted++,
                    'updated' => $updated++,
                    'skipped' => $skipped++,
                };
            } catch (\Throwable $e) {
                $errors++;
                $errorLog[] = [
                    'line' => $lineNum,
                    'message' => $e->getMessage(),
                    'data' => array_combine($fileHeaders, $line) ?: [],
                ];
            }
        }
        fclose($handle);

        $import->update([
            'total_rows' => $totalRows,
            'inserted' => $inserted,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => $errors,
            'error_log' => $errorLog,
            'status' => 'done',
        ]);

        return response()->json([
            'import_id' => $import->id,
            'total_rows' => $totalRows,
            'inserted' => $inserted,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => $errors,
            'error_log' => array_slice($errorLog, 0, 50),
        ]);
    }

    /**
     * Histórico de importações.
     */
    public function history(Request $request): JsonResponse
    {
        $imports = Import::where('tenant_id', $request->user()->tenant_id)
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($imports);
    }

    /**
     * Lista templates salvos.
     */
    public function templates(Request $request): JsonResponse
    {
        $templates = ImportTemplate::where('tenant_id', $request->user()->tenant_id)
            ->when($request->entity_type, fn($q, $e) => $q->where('entity_type', $e))
            ->orderBy('name')
            ->get();

        return response()->json(['templates' => $templates]);
    }

    /**
     * Salva um template de mapeamento.
     */
    public function saveTemplate(Request $request): JsonResponse
    {
        $request->validate([
            'entity_type' => 'required|in:customers,products,services,equipments',
            'name' => 'required|string|max:100',
            'mapping' => 'required|array',
        ]);

        $template = ImportTemplate::updateOrCreate(
            [
                'tenant_id' => $request->user()->tenant_id,
                'entity_type' => $request->input('entity_type'),
                'name' => $request->input('name'),
            ],
            ['mapping' => $request->input('mapping')]
        );

        return response()->json(['template' => $template], 201);
    }

    // ─── Métodos privados ───────────────────────────────────────

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
        $requiredFields = array_filter(
            $this->entityFields[$entity],
            fn($f) => $f['required']
        );

        // Checar campos obrigatórios
        foreach ($requiredFields as $field) {
            if (empty($data[$field['key']] ?? '')) {
                $messages[] = "Campo obrigatório '{$field['label']}' vazio";
                $status = 'error';
            }
        }

        if ($status === 'error') return compact('status', 'messages');

        // Checar duplicatas
        $duplicate = $this->findDuplicate($data, $entity, $tenantId);
        if ($duplicate) {
            $messages[] = "Registro já existe (ID: {$duplicate->id})";
            $status = 'warning';
        }

        // Validações específicas
        if ($entity === 'customers' && !empty($data['document'])) {
            $doc = preg_replace('/\D/', '', $data['document']);
            if (strlen($doc) !== 11 && strlen($doc) !== 14) {
                $messages[] = 'CPF/CNPJ inválido';
                $status = 'error';
            }
        }

        if (in_array($entity, ['products', 'services'])) {
            $priceField = $entity === 'products' ? 'sell_price' : 'default_price';
            if (isset($data[$priceField]) && !is_numeric(str_replace(',', '.', $data[$priceField]))) {
                $messages[] = 'Preço inválido';
                $status = 'error';
            }
        }

        return compact('status', 'messages');
    }

    private function findDuplicate(array $data, string $entity, int $tenantId): ?object
    {
        return match ($entity) {
            'customers' => !empty($data['document'])
                ? Customer::where('tenant_id', $tenantId)
                    ->where('document', preg_replace('/\D/', '', $data['document']))
                    ->first()
                : null,
            'products' => !empty($data['code'])
                ? Product::where('tenant_id', $tenantId)
                    ->where('code', $data['code'])
                    ->first()
                : null,
            'services' => !empty($data['code'])
                ? Service::where('tenant_id', $tenantId)
                    ->where('code', $data['code'])
                    ->first()
                : null,
            'equipments' => !empty($data['serial_number'])
                ? Equipment::where('tenant_id', $tenantId)
                    ->where('serial_number', $data['serial_number'])
                    ->first()
                : null,
            default => null,
        };
    }

    private function importRow(array $data, string $entity, int $tenantId, string $strategy): string
    {
        $existing = $this->findDuplicate($data, $entity, $tenantId);

        if ($existing) {
            return match ($strategy) {
                'skip' => 'skipped',
                'update' => $this->updateExisting($existing, $data, $entity) ? 'updated' : 'skipped',
                'create' => $this->createNew($data, $entity, $tenantId) ? 'inserted' : 'skipped',
                default => 'skipped',
            };
        }

        $this->createNew($data, $entity, $tenantId);
        return 'inserted';
    }

    private function createNew(array $data, string $entity, int $tenantId): bool
    {
        $data['tenant_id'] = $tenantId;
        $data['is_active'] = true;

        // Limpar e converter preços
        $this->normalizeNumericFields($data, $entity);

        // Resolver referências (categoria, cliente)
        $this->resolveReferences($data, $entity, $tenantId);

        return match ($entity) {
            'customers' => (bool) Customer::create($this->filterFields($data, Customer::class)),
            'products' => (bool) Product::create($this->filterFields($data, Product::class)),
            'services' => (bool) Service::create($this->filterFields($data, Service::class)),
            'equipments' => (bool) Equipment::create($this->filterFields($data, Equipment::class)),
            default => false,
        };
    }

    private function updateExisting(object $record, array $data, string $entity): bool
    {
        $this->normalizeNumericFields($data, $entity);
        unset($data['tenant_id']);

        // Remover campos vazios para não sobrescrever
        $data = array_filter($data, fn($v) => $v !== '' && $v !== null);

        $record->update($this->filterFields($data, get_class($record)));
        return true;
    }

    private function normalizeNumericFields(array &$data, string $entity): void
    {
        $numericKeys = match ($entity) {
            'products' => ['sell_price', 'cost_price', 'stock_qty', 'stock_min'],
            'services' => ['default_price', 'estimated_minutes'],
            default => [],
        };

        foreach ($numericKeys as $key) {
            if (isset($data[$key])) {
                $data[$key] = (float) str_replace(',', '.', str_replace('.', '', preg_replace('/[^\d,.]/', '', $data[$key])));
            }
        }

        if ($entity === 'customers' && !empty($data['document'])) {
            $data['document'] = preg_replace('/\D/', '', $data['document']);
        }
    }

    private function resolveReferences(array &$data, string $entity, int $tenantId): void
    {
        // Resolver categoria por nome
        if (!empty($data['category_name'])) {
            $categoryModel = $entity === 'products'
                ? \App\Models\ProductCategory::class
                : \App\Models\ServiceCategory::class;

            $cat = $categoryModel::firstOrCreate(
                ['tenant_id' => $tenantId, 'name' => $data['category_name']],
                ['tenant_id' => $tenantId, 'name' => $data['category_name']]
            );
            $data['category_id'] = $cat->id;
            unset($data['category_name']);
        }

        // Resolver cliente por documento (para equipamentos)
        if ($entity === 'equipments' && !empty($data['customer_document'])) {
            $doc = preg_replace('/\D/', '', $data['customer_document']);
            $customer = Customer::where('tenant_id', $tenantId)->where('document', $doc)->first();
            if ($customer) {
                $data['customer_id'] = $customer->id;
            }
            unset($data['customer_document']);
        }
    }

    private function filterFields(array $data, string $modelClass): array
    {
        $model = new $modelClass;
        $fillable = $model->getFillable();
        return array_intersect_key($data, array_flip($fillable));
    }
}
