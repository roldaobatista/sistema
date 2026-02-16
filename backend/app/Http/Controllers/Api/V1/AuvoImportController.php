<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuvoIdMapping;
use App\Models\AuvoImport;
use App\Models\TenantSetting;
use App\Services\Auvo\AuvoApiClient;
use App\Services\Auvo\AuvoImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuvoImportController extends Controller
{
    private function client(Request $request): AuvoApiClient
    {
        return AuvoApiClient::forTenant($request->user()->current_tenant_id);
    }

    /**
     * Test connection to Auvo API and return entity counts.
     */
    public function testConnection(Request $request): JsonResponse
    {
        $client = $this->client($request);

        $connectionResult = $client->testConnection();

        if ($connectionResult['connected']) {
            try {
                $counts = $client->getEntityCounts();
                $connectionResult['available_entities'] = $counts;
            } catch (\Exception $e) {
                $connectionResult['available_entities'] = [];
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
            return response()->json(['message' => "Tipo de entidade inválido: {$entity}"], 422);
        }

        try {
            $client = $this->client($request);

            if (!$client->hasCredentials()) {
                return response()->json([
                    'message' => 'Credenciais Auvo não configuradas. Configure em Credenciais.',
                ], 422);
            }

            $service = new AuvoImportService($client);
            $limit = min((int) $request->get('limit', 10), 50);
            $result = $service->preview($entity, $limit);

            return response()->json([
                'entity' => $entity,
                'entity_label' => AuvoImport::ENTITY_TYPES[$entity],
                'total' => $result['total'],
                'sample' => $result['sample'],
                'mapped_fields' => $result['mapped_fields'],
            ]);
        } catch (\Exception $e) {
            Log::error('Auvo: preview failed', ['entity' => $entity, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao buscar dados: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Import a specific entity type.
     */
    public function import(Request $request, string $entity): JsonResponse
    {
        if (!isset(AuvoImport::ENTITY_TYPES[$entity])) {
            return response()->json(['message' => "Tipo de entidade inválido: {$entity}"], 422);
        }

        $strategy = $request->get('strategy', 'skip');
        if (!in_array($strategy, ['skip', 'update'])) {
            return response()->json(['message' => 'Estratégia inválida. Use "skip" ou "update".'], 422);
        }

        try {
            $client = $this->client($request);

            if (!$client->hasCredentials()) {
                return response()->json([
                    'message' => 'Credenciais Auvo não configuradas. Configure em Credenciais.',
                ], 422);
            }

            $service = new AuvoImportService($client);
            $tenantId = $request->user()->current_tenant_id;
            $userId = $request->user()->id;

            $result = $service->importEntity($entity, $tenantId, $userId, $strategy);

            $message = 'Importação concluída';
            if (($result['total_errors'] ?? 0) > 0) {
                $firstError = $result['first_error'] ?? null;
                $message .= sprintf('. %d erro(s).', $result['total_errors']);
                if ($firstError) {
                    $message .= ' Ex.: ' . (is_string($firstError) ? $firstError : ($firstError['message'] ?? json_encode($firstError)));
                }
            }

            return response()->json(array_merge([
                'message' => $message,
                'entity_label' => AuvoImport::ENTITY_TYPES[$entity],
            ], $result));
        } catch (\Exception $e) {
            Log::error('Auvo: import failed', ['entity' => $entity, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
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
            $client = $this->client($request);

            if (!$client->hasCredentials()) {
                return response()->json([
                    'message' => 'Credenciais Auvo não configuradas. Configure em Credenciais.',
                ], 422);
            }

            $service = new AuvoImportService($client);
            $tenantId = $request->user()->current_tenant_id;
            $userId = $request->user()->id;

            $results = $service->importAll($tenantId, $userId, $strategy);

            $totalInserted = 0;
            $totalErrors = 0;
            foreach ($results as $r) {
                $totalInserted += $r['total_imported'] ?? 0;
                $totalErrors += $r['total_errors'] ?? 0;
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
            Log::error('Auvo: full import failed', ['error' => $e->getMessage()]);
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
            return response()->json(['message' => 'Esta importação já foi desfeita.'], 422);
        }

        if ($import->status !== AuvoImport::STATUS_DONE) {
            return response()->json(['message' => 'Só é possível desfazer importações concluídas.'], 422);
        }

        try {
            $client = $this->client($request);
            $service = new AuvoImportService($client);
            $result = $service->rollback($import);

            return response()->json([
                'message' => 'Importação desfeita com sucesso',
                'result' => $result,
            ]);
        } catch (\Exception $e) {
            Log::error('Auvo: rollback failed', ['import_id' => $id, 'error' => $e->getMessage()]);
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
     * Save Auvo API credentials (persisted in tenant_settings DB table).
     */
    public function config(Request $request): JsonResponse
    {
        $request->validate([
            'api_key' => 'required|string|min:5',
            'api_token' => 'required|string|min:5',
        ]);

        $tenantId = $request->user()->current_tenant_id;

        // Save to database (persistent, per-tenant)
        TenantSetting::setValue($tenantId, 'auvo_credentials', [
            'api_key' => $request->api_key,
            'api_token' => $request->api_token,
        ]);

        // Test connection with the provided credentials
        $client = new AuvoApiClient($request->api_key, $request->api_token, $tenantId);
        $result = $client->testConnection();

        return response()->json([
            'message' => $result['connected']
                ? 'Credenciais salvas e conexão verificada com sucesso!'
                : 'Credenciais salvas, mas a conexão falhou: ' . $result['message'],
            'saved' => true,
            'connected' => $result['connected'],
        ]);
    }

    /**
     * Get current Auvo API credentials (masked for security).
     */
    public function getConfig(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $credentials = TenantSetting::getValue($tenantId, 'auvo_credentials');

        $apiKey = $credentials['api_key'] ?? config('services.auvo.api_key', '');
        $apiToken = $credentials['api_token'] ?? config('services.auvo.api_token', '');

        return response()->json([
            'has_credentials' => !empty($apiKey) && !empty($apiToken),
            'api_key' => $apiKey,
            'api_token' => $apiToken,
        ]);
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
                'last_import_at' => $lastImport?->completed_at ?? $lastImport?->last_synced_at,
                'total_imported' => $lastImport?->total_imported ?? 0,
                'total_updated' => $lastImport?->total_updated ?? 0,
                'total_errors' => $lastImport?->total_errors ?? 0,
                'total_mapped' => $mappingCount,
                'status' => $lastImport?->status ?? 'never',
            ];
        }

        $totalMappings = AuvoIdMapping::where('tenant_id', $tenantId)->count();

        return response()->json([
            'entities' => $statuses,
            'total_mappings' => $totalMappings,
        ]);
    }

    /**
     * Delete a specific import history record.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $import = AuvoImport::where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$import) {
            return response()->json(['message' => 'Registro de importação não encontrado.'], 404);
        }

        try {
            DB::beginTransaction();
            AuvoIdMapping::where('import_id', $import->id)->delete();
            $import->delete();
            DB::commit();

            return response()->json(['message' => 'Registro de importação removido com sucesso.']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Auvo: delete import failed', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover registro.'], 500);
        }
    }
}
