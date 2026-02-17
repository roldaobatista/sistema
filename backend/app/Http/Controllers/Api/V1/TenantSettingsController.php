<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\TenantSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantSettingsController extends Controller
{
    public function index(): JsonResponse
    {
        if (!app()->bound('current_tenant_id')) {
            return response()->json(['message' => 'Nenhuma empresa selecionada.'], 403);
        }

        $settings = TenantSetting::orderBy('key')->get();

        $mapped = $settings->mapWithKeys(fn ($s) => [$s->key => $s->value_json]);

        return response()->json($mapped);
    }

    public function show(string $key): JsonResponse
    {
        if (!app()->bound('current_tenant_id')) {
            return response()->json(['message' => 'Nenhuma empresa selecionada.'], 403);
        }

        $tenantId = app('current_tenant_id');
        $value = TenantSetting::getValue($tenantId, $key);

        return response()->json(['key' => $key, 'value' => $value]);
    }

    public function upsert(Request $request): JsonResponse
    {
        if (!app()->bound('current_tenant_id')) {
            return response()->json(['message' => 'Nenhuma empresa selecionada.'], 403);
        }

        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string|max:100',
            'settings.*.value' => 'present',
        ]);

        $tenantId = app('current_tenant_id');

        foreach ($validated['settings'] as $item) {
            TenantSetting::setValue($tenantId, $item['key'], $item['value']);
        }

        AuditLog::log('updated', 'Configurações da empresa atualizadas');

        $all = TenantSetting::orderBy('key')->get()
            ->mapWithKeys(fn ($s) => [$s->key => $s->value_json]);

        return response()->json($all);
    }

    public function destroy(string $key): JsonResponse
    {
        if (!app()->bound('current_tenant_id')) {
            return response()->json(['message' => 'Nenhuma empresa selecionada.'], 403);
        }

        $tenantId = app('current_tenant_id');

        $deleted = TenantSetting::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('key', $key)
            ->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Configuração não encontrada.'], 404);
        }

        AuditLog::log('deleted', "Configuração '{$key}' removida");

        return response()->json(null, 204);
    }
}
