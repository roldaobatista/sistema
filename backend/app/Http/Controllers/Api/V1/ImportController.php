<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Import;
use App\Models\ImportTemplate;
use App\Services\ImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends Controller
{
    private ImportService $importService;

    public function __construct(ImportService $importService)
    {
        $this->importService = $importService;
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
            return response()->json(['message' => 'Erro ao processar arquivo: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Preview: valida as primeiras N linhas com o mapeamento fornecido.
     */
    public function preview(Request $request): JsonResponse
    {
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
                $request->user()->tenant_id
            );
            return response()->json($result);
        } catch (\Throwable $e) {
             return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Executa a importação completa dentro de transação.
     */
    public function execute(Request $request): JsonResponse
    {
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

        // Criar registro de importação
        $import = Import::create([
            'tenant_id' => $request->user()->tenant_id,
            'user_id' => $request->user()->id,
            'entity_type' => $request->input('entity_type'),
            'file_name' => $filePath,
            'mapping' => $request->input('mapping'),
            'separator' => $request->input('separator', ';'),
            'duplicate_strategy' => $request->input('duplicate_strategy', Import::STRATEGY_SKIP),
            'status' => Import::STATUS_PROCESSING,
        ]);

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
            'entity_type' => 'required|in:' . implode(',', array_keys(Import::ENTITY_TYPES)),
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

    /**
     * Deleta um template de mapeamento.
     */
    public function deleteTemplate(Request $request, int $id): JsonResponse
    {
        $template = ImportTemplate::where('tenant_id', $request->user()->tenant_id)
            ->where('id', $id)
            ->first();

        if (!$template) {
            return response()->json(['message' => 'Template não encontrado'], 404);
        }

        $template->delete();
        return response()->json(['message' => 'Template removido']);
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
     * Exporta log de erros de uma importação como CSV.
     */
    public function exportErrors(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $import = Import::where('tenant_id', $request->user()->tenant_id)
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
        $import = Import::where('tenant_id', $request->user()->tenant_id)
            ->where('id', $id)
            ->first();

        if (!$import) {
            return response()->json(['message' => 'Importação não encontrada'], 404);
        }

        if ($import->status !== Import::STATUS_DONE) {
            return response()->json(['message' => 'Somente importações concluídas podem ser desfeitas'], 422);
        }

        try {
            $result = $this->importService->rollbackImport($import);
            return response()->json([
                'message' => "{$result['deleted']} de {$result['total']} registros removidos",
                'deleted' => $result['deleted'],
                'total' => $result['total'],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // ─── Métodos privados ───────────────────────────────────────

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
