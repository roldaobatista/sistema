<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Import;
use App\Models\ImportTemplate;
use App\Services\ImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends Controller
{
    private ImportService $importService;

    public function __construct(ImportService $importService)
    {
        $this->importService = $importService;
    }

    private function tenantId(Request $request): int
    {
        $user = $request->user();

        return app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    /**
     * Retorna campos disponíveis por entidade.
     */
    public function fields(string $entity): JsonResponse
    {
        $fields = $this->importService->getFields($entity);
        
        if (empty($fields)) {
            return response()->json(['message' => 'Entidade inválida'], 422);
        }

        return response()->json(['fields' => $fields]);
    }

    /**
     * Upload do arquivo e retorna headers detectados.
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:10240',
            'entity_type' => 'required|in:' . implode(',', array_keys(Import::ENTITY_TYPES)),
        ]);

        try {
            $result = $this->importService->processUpload(
                $request->file('file'),
                $request->input('entity_type')
            );
            return response()->json($result);
        } catch (\Throwable $e) {
            Log::error('Import upload failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao processar arquivo: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Preview: valida as primeiras N linhas com o mapeamento fornecido.
     */
    public function preview(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $request->validate([
            'file_path' => 'required|string',
            'entity_type' => 'required|in:' . implode(',', array_keys(Import::ENTITY_TYPES)),
            'mapping' => 'required|array',
            'separator' => 'nullable|string',
            'limit' => 'nullable|integer|min:5|max:100',
        ]);

        $filePath = $request->input('file_path');
        if (!$this->isValidImportPath($filePath)) {
            return response()->json(['message' => 'Caminho de arquivo inválido'], 422);
        }

        $fullPath = Storage::disk('local')->path($filePath);
        if (!file_exists($fullPath)) {
            return response()->json(['message' => 'Arquivo não encontrado'], 404);
        }

        try {
            $result = $this->importService->generatePreview(
                $filePath,
                $request->input('entity_type'),
                $request->input('mapping'),
                $request->input('separator', ';'),
                $request->input('limit', 20),
                $tenantId
            );
            return response()->json($result);
        } catch (\Throwable $e) {
            Log::error('Import preview failed', ['error' => $e->getMessage(), 'file' => $filePath]);
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Executa a importação completa dentro de transação.
     */
    public function execute(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $request->validate([
            'file_path' => 'required|string',
            'entity_type' => 'required|in:' . implode(',', array_keys(Import::ENTITY_TYPES)),
            'mapping' => 'required|array',
            'separator' => ['nullable', 'string', 'in:;,\,,tab'],
            'duplicate_strategy' => 'nullable|in:' . implode(',', array_keys(Import::STRATEGIES)),
        ]);

        $filePath = $request->input('file_path');
        if (!$this->isValidImportPath($filePath)) {
             return response()->json(['message' => 'Caminho inválido'], 422);
        }

        // F2: Verificar limite de linhas
        $fullPath = Storage::disk('local')->path($filePath);
        if (file_exists($fullPath)) {
            $lineCount = $this->importService->countCsvRows($fullPath);
            if ($lineCount > Import::MAX_ROWS_LIMIT) {
                return response()->json([
                    'message' => "O arquivo possui {$lineCount} linhas, excedendo o limite de " . Import::MAX_ROWS_LIMIT . " linhas por importação.",
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            $import = Import::create([
                'tenant_id' => $tenantId,
                'user_id' => $request->user()->id,
                'entity_type' => $request->input('entity_type'),
                'file_name' => $filePath,
                'original_name' => $request->input('original_name'),
                'mapping' => $request->input('mapping'),
                'separator' => $request->input('separator', ';'),
                'duplicate_strategy' => $request->input('duplicate_strategy', Import::STRATEGY_SKIP),
                'status' => Import::STATUS_PROCESSING,
            ]);
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Import record creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar registro de importação'], 500);
        }

        try {
            $this->importService->executeImport($import);
            $import->refresh();

            return response()->json([
                'import_id' => $import->id,
                'total_rows' => $import->total_rows,
                'inserted' => $import->inserted,
                'updated' => $import->updated,
                'skipped' => $import->skipped,
                'errors' => $import->errors,
                'error_log' => array_slice($import->error_log ?? [], 0, 50),
            ]);
        } catch (\Throwable $e) {
            Log::error('Import execution failed', [
                'import_id' => $import->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            $import->update([
                'status' => Import::STATUS_FAILED,
                'error_log' => [['line' => 0, 'message' => $e->getMessage()]]
            ]);
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Histórico de importações.
     */
    public function history(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $imports = Import::where('tenant_id', $tenantId)
            ->with('user:id,name')
            ->when($request->entity_type, fn($q, $e) => $q->where('entity_type', $e))
            ->when($request->status, fn($q, $s) => $q->where('status', $s))
            ->when($request->date_from, fn($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($request->date_to, fn($q, $d) => $q->whereDate('created_at', '<=', $d))
            ->when($request->search, fn($q, $s) => $q->search($s))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($imports);
    }

    /**
     * Lista templates salvos.
     */
    public function templates(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $templates = ImportTemplate::where('tenant_id', $tenantId)
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
        $tenantId = $this->tenantId($request);

        $request->validate([
            'entity_type' => 'required|in:' . implode(',', array_keys(Import::ENTITY_TYPES)),
            'name' => 'required|string|max:100',
            'mapping' => 'required|array',
        ]);

        DB::beginTransaction();
        try {
            $template = ImportTemplate::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'entity_type' => $request->input('entity_type'),
                    'name' => $request->input('name'),
                ],
                ['mapping' => $request->input('mapping')]
            );
            DB::commit();

            return response()->json(['template' => $template], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Save template failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao salvar template'], 500);
        }
    }

    /**
     * Deleta um template de mapeamento.
     */
    public function deleteTemplate(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $template = ImportTemplate::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (!$template) {
            return response()->json(['message' => 'Template não encontrado'], 404);
        }

        DB::beginTransaction();
        try {
            $template->delete();
            DB::commit();
            return response()->json(['message' => 'Template removido']);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Delete template failed', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover template'], 500);
        }
    }

    /**
     * Download CSV modelo para uma entidade.
     */
    public function downloadSample(string $entity): StreamedResponse|JsonResponse
    {
        $csv = $this->importService->generateSampleCsv($entity);

        if (empty($csv)) {
            return response()->json(['message' => 'Entidade inválida'], 422);
        }

        $filename = "modelo_importacao_{$entity}.csv";

        return response()->streamDownload(function () use ($csv) {
            echo $csv;
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Exporta todos os dados de uma entidade como CSV.
     */
    public function exportData(Request $request, string $entity): StreamedResponse|JsonResponse
    {
        $tenantId = $this->tenantId($request);

        try {
            $csv = $this->importService->exportEntityData($entity, $tenantId);

            if (empty($csv)) {
                return response()->json(['message' => 'Entidade inválida'], 422);
            }

            $date = now()->format('Y-m-d');
            $filename = "exportacao_{$entity}_{$date}.csv";

            return response()->streamDownload(function () use ($csv) {
                echo $csv;
            }, $filename, [
                'Content-Type' => 'text/csv; charset=UTF-8',
            ]);
        } catch (\Throwable $e) {
            Log::error('Export failed', ['entity' => $entity, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao exportar dados'], 500);
        }
    }

    /**
     * Exporta log de erros de uma importação como CSV.
     */
    public function exportErrors(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $import = Import::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (!$import) {
            return response()->json(['message' => 'Importação não encontrada'], 404);
        }

        $csv = $this->importService->exportErrorCsv($import);

        if (empty($csv)) {
            return response()->json(['message' => 'Nenhum erro registrado'], 404);
        }

        $filename = "erros_importacao_{$import->id}.csv";

        return response()->streamDownload(function () use ($csv) {
            echo $csv;
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Desfaz uma importação.
     */
    public function rollback(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $import = Import::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (!$import) {
            return response()->json(['message' => 'Importação não encontrada'], 404);
        }

        if (!in_array($import->status, [Import::STATUS_DONE])) {
            return response()->json(['message' => 'Somente importações concluídas podem ser desfeitas'], 422);
        }

        try {
            $result = $this->importService->rollbackImport($import);

            $message = ($result['failed'] ?? 0) > 0
                ? "{$result['deleted']} removidos, {$result['failed']} não puderam ser removidos (possuem vínculos)"
                : "{$result['deleted']} de {$result['total']} registros removidos";

            return response()->json([
                'message' => $message,
                'deleted' => $result['deleted'],
                'failed' => $result['failed'] ?? 0,
                'total' => $result['total'],
            ]);
        } catch (\Throwable $e) {
            Log::error('Import rollback failed', ['import_id' => $import->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Retorna detalhes de uma importação específica.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $import = Import::where('tenant_id', $tenantId)
            ->with('user:id,name')
            ->where('id', $id)
            ->first();

        if (!$import) {
            return response()->json(['message' => 'Importação não encontrada'], 404);
        }

        return response()->json(['import' => $import]);
    }

    /**
     * Remove registro de importação (apenas failed/pending).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $import = Import::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (!$import) {
            return response()->json(['message' => 'Importação não encontrada'], 404);
        }

        if (!in_array($import->status, [Import::STATUS_FAILED, Import::STATUS_ROLLED_BACK, Import::STATUS_PARTIALLY_ROLLED_BACK])) {
            return response()->json(['message' => 'Apenas importações falhadas ou desfeitas podem ser removidas'], 422);
        }

        DB::beginTransaction();
        try {
            $import->delete();
            DB::commit();
            return response()->json(['message' => 'Registro de importação removido']);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Import delete failed', ['import_id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover registro'], 500);
        }
    }

    // ─── Métodos privados ───────────────────────────────────────

    /**
     * Estatísticas de importação por entidade.
     */
    public function stats(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        // I1: Query agregada otimizada — 2 queries em vez de 20
        $aggregated = Import::where('tenant_id', $tenantId)
            ->selectRaw("entity_type, COUNT(*) as total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as done, SUM(CASE WHEN status = ? THEN inserted ELSE 0 END) as total_inserted, SUM(CASE WHEN status = ? THEN updated ELSE 0 END) as total_updated", [
                Import::STATUS_DONE, Import::STATUS_DONE, Import::STATUS_DONE,
            ])
            ->groupBy('entity_type')
            ->get()
            ->keyBy('entity_type');

        $lastImports = Import::where('tenant_id', $tenantId)
            ->whereIn('id', function ($q) use ($tenantId) {
                $q->selectRaw('MAX(id)')
                    ->from('imports')
                    ->where('tenant_id', $tenantId)
                    ->groupBy('entity_type');
            })
            ->get()
            ->keyBy('entity_type');

        $stats = [];
        foreach (array_keys(Import::ENTITY_TYPES) as $entity) {
            $agg = $aggregated->get($entity);
            $last = $lastImports->get($entity);
            $total = (int) ($agg?->total ?? 0);
            $done = (int) ($agg?->done ?? 0);

            $stats[$entity] = [
                'total_imports' => $total,
                'successful' => $done,
                'success_rate' => $total > 0 ? round(($done / $total) * 100, 1) : 0,
                'total_inserted' => (int) ($agg?->total_inserted ?? 0),
                'total_updated' => (int) ($agg?->total_updated ?? 0),
                'last_import_at' => $last?->created_at,
                'last_status' => $last?->status,
            ];
        }

        return response()->json(['stats' => $stats]);
    }

    /**
     * Retorna contagem de registros por entidade para exibir no Step 0.
     */
    public function entityCounts(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $counts = [];
        $models = [
            Import::ENTITY_CUSTOMERS => \App\Models\Customer::class,
            Import::ENTITY_PRODUCTS => \App\Models\Product::class,
            Import::ENTITY_SERVICES => \App\Models\Service::class,
            Import::ENTITY_EQUIPMENTS => \App\Models\Equipment::class,
            Import::ENTITY_SUPPLIERS => \App\Models\Supplier::class,
        ];

        foreach ($models as $entity => $modelClass) {
            $counts[$entity] = $modelClass::where('tenant_id', $tenantId)->count();
        }

        return response()->json(['counts' => $counts]);
    }

    /**
     * Valida que o caminho do arquivo é seguro (anti path traversal).
     */
    private function isValidImportPath(string $path): bool
    {
        if (str_contains($path, '..') || str_contains($path, '\\')) {
            return false;
        }
        if (!str_starts_with($path, 'imports/')) {
            return false;
        }
        return true;
    }
}
