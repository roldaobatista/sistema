<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuvoIdMapping;
use App\Models\AuvoImport;
use App\Services\Auvo\AuvoApiClient;
use App\Services\Auvo\AuvoImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuvoImportController extends Controller
{
    /**
     * Test connection to Auvo API and return entity counts.
     */
    public function testConnection(): JsonResponse
    {
        $client = new AuvoApiClient();

        if (!$client->hasCredentials()) {
            return response()->json([
                'connected' => false,
                'message' => 'Credenciais da API Auvo não configuradas. Defina AUVO_API_KEY e AUVO_API_TOKEN no .env',
            ], 200);
        }

        $connectionResult = $client->testConnection();

        if ($connectionResult['connected']) {
            try {
                $counts = $client->getEntityCounts();
                $connectionResult['entity_counts'] = $counts;
            } catch (\Exception $e) {
                $connectionResult['entity_counts'] = [];
                $connectionResult['counts_error'] = $e->getMessage();
            }
        }

        return response()->json($connectionResult);
    }

    /**
     * Preview data from Auvo before importing.
     */
    public function preview(Request $request, string $entity): JsonResponse
    {
        if (!isset(AuvoImport::ENTITY_TYPES[$entity])) {
            return response()->json(['message' => 'Tipo de entidade inválido'], 422);
        }

        try {
            $client = new AuvoApiClient();
            $service = new AuvoImportService($client);
            $limit = min((int) $request->get('limit', 10), 50);

            $records = $service->preview($entity, $limit);

            return response()->json([
                'entity' => $entity,
                'entity_label' => AuvoImport::ENTITY_TYPES[$entity],
                'count' => count($records),
                'records' => $records,
            ]);
        } catch (\Exception $e) {
            Log::error('Auvo preview failed', ['entity' => $entity, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar dados: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Import a specific entity type.
     */
    public function import(Request $request, string $entity): JsonResponse
    {
        if (!isset(AuvoImport::ENTITY_TYPES[$entity])) {
            return response()->json(['message' => 'Tipo de entidade inválido'], 422);
        }

        $strategy = $request->get('strategy', 'skip');
        if (!in_array($strategy, ['skip', 'update'])) {
            return response()->json(['message' => 'Estratégia inválida. Use "skip" ou "update"'], 422);
        }

        try {
            $client = new AuvoApiClient();
            $service = new AuvoImportService($client);

            $tenantId = $request->user()->current_tenant_id;
            $userId = $request->user()->id;

            $result = $service->importEntity($entity, $tenantId, $userId, $strategy);

            return response()->json([
                'message' => 'Importação concluída',
                'entity' => $entity,
                'entity_label' => AuvoImport::ENTITY_TYPES[$entity],
                'result' => $result,
            ]);
        } catch (\Exception $e) {
            Log::error('Auvo import failed', ['entity' => $entity, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na importação: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Import all entities in dependency order.
     */
    public function importAll(Request $request): JsonResponse
    {
        $strategy = $request->get('strategy', 'skip');

        try {
            $client = new AuvoApiClient();
            $service = new AuvoImportService($client);

            $tenantId = $request->user()->current_tenant_id;
            $userId = $request->user()->id;

            $results = $service->importAll($tenantId, $userId, $strategy);

            $totalInserted = 0;
            $totalErrors = 0;
            foreach ($results as $r) {
                $totalInserted += $r['inserted'] ?? 0;
                $totalErrors += $r['errors'] ?? 0;
            }

            return response()->json([
                'message' => 'Importação completa finalizada',
                'summary' => [
                    'total_entities' => count($results),
                    'total_inserted' => $totalInserted,
                    'total_errors' => $totalErrors,
                ],
                'details' => $results,
            ]);
        } catch (\Exception $e) {
            Log::error('Auvo full import failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na importação: ' . $e->getMessage()], 500);
        }
    }

    /**
     * List import history.
     */
    public function history(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $query = AuvoImport::where('tenant_id', $tenantId)
            ->with('user:id,name')
            ->orderByDesc('created_at');

        if ($request->has('entity')) {
            $query->byEntity($request->get('entity'));
        }

        if ($request->has('status')) {
            $query->byStatus($request->get('status'));
        }

        $imports = $query->paginate($request->get('per_page', 20));

        return response()->json($imports);
    }

    /**
     * Rollback a specific import.
     */
    public function rollback(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $import = AuvoImport::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if ($import->status === AuvoImport::STATUS_ROLLED_BACK) {
            return response()->json(['message' => 'Esta importação já foi desfeita'], 422);
        }

        if ($import->status !== AuvoImport::STATUS_DONE) {
            return response()->json(['message' => 'Só é possível desfazer importações concluídas'], 422);
        }

        try {
            $client = new AuvoApiClient();
            $service = new AuvoImportService($client);
            $result = $service->rollback($import);

            return response()->json([
                'message' => 'Importação desfeita com sucesso',
                'result' => $result,
            ]);
        } catch (\Exception $e) {
            Log::error('Auvo rollback failed', ['import_id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao desfazer: ' . $e->getMessage()], 500);
        }
    }

    /**
     * List ID mappings (Auvo ↔ Kalibrium).
     */
    public function mappings(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $query = AuvoIdMapping::where('tenant_id', $tenantId);

        if ($request->has('entity')) {
            $query->where('entity_type', $request->get('entity'));
        }

        $mappings = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 50));

        return response()->json($mappings);
    }

    /**
     * Save Auvo API credentials.
     */
    public function config(Request $request): JsonResponse
    {
        $request->validate([
            'api_key' => 'required|string|min:5',
            'api_token' => 'required|string|min:5',
        ]);

        // Always save credentials first
        config([
            'services.auvo.api_key' => $request->api_key,
            'services.auvo.api_token' => $request->api_token,
        ]);

        $this->updateEnvFile('AUVO_API_KEY', $request->api_key);
        $this->updateEnvFile('AUVO_API_TOKEN', $request->api_token);

        // Test connection after saving (non-blocking)
        $client = new AuvoApiClient($request->api_key, $request->api_token);
        $result = $client->testConnection();

        $message = $result['connected']
            ? 'Credenciais Auvo salvas e conexão verificada com sucesso'
            : 'Credenciais salvas, mas a conexão falhou: ' . $result['message'];

        return response()->json([
            'message' => $message,
            'saved' => true,
            'connected' => $result['connected'],
        ]);
    }

    /**
     * Get current Auvo API credentials.
     */
    public function getConfig(): JsonResponse
    {
        $apiKey = config('services.auvo.api_key', '');
        $apiToken = config('services.auvo.api_token', '');

        return response()->json([
            'has_credentials' => !empty($apiKey) && !empty($apiToken),
            'api_key' => $apiKey ?: '',
            'api_token' => $apiToken ?: '',
        ]);
    }

    /**
     * Update a single key in the .env file.
     */
    private function updateEnvFile(string $key, string $value): void
    {
        $envPath = base_path('.env');
        if (!file_exists($envPath)) {
            return;
        }

        $content = file_get_contents($envPath);
        $escapedValue = str_contains($value, ' ') ? '"' . $value . '"' : $value;

        if (preg_match("/^{$key}=.*/m", $content)) {
            $content = preg_replace("/^{$key}=.*/m", "{$key}={$escapedValue}", $content);
        } else {
            $content .= "\n{$key}={$escapedValue}";
        }

        file_put_contents($envPath, $content);
    }

    /**
     * Get last sync status per entity.
     */
    public function syncStatus(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $statuses = [];
        foreach (AuvoImport::ENTITY_TYPES as $entity => $label) {
            $lastImport = AuvoImport::where('tenant_id', $tenantId)
                ->where('entity_type', $entity)
                ->where('status', AuvoImport::STATUS_DONE)
                ->orderByDesc('created_at')
                ->first();

            $mappingCount = AuvoIdMapping::where('tenant_id', $tenantId)
                ->where('entity_type', $entity)
                ->count();

            $statuses[$entity] = [
                'label' => $label,
                'last_synced_at' => $lastImport?->last_synced_at,
                'last_inserted' => $lastImport?->inserted ?? 0,
                'last_updated' => $lastImport?->updated ?? 0,
                'last_errors' => $lastImport?->errors ?? 0,
                'total_mapped' => $mappingCount,
            ];
        }

        $totalMappings = AuvoIdMapping::where('tenant_id', $tenantId)->count();

        return response()->json([
            'entities' => $statuses,
            'total_mappings' => $totalMappings,
        ]);
    }
}
