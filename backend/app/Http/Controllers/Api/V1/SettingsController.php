<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    // ── Configurações ──

    public function index(Request $request): JsonResponse
    {
        $query = SystemSetting::query();
        if ($group = $request->get('group')) {
            $query->where('group', $group);
        }
        return response()->json($query->orderBy('group')->orderBy('key')->get());
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string|max:100',
            'settings.*.value' => 'nullable',
            'settings.*.type' => 'sometimes|string|in:string,boolean,integer,json',
            'settings.*.group' => 'sometimes|string|max:50',
        ]);

        $saved = [];
        foreach ($validated['settings'] as $item) {
            $saved[] = SystemSetting::setValue(
                $item['key'],
                $item['value'],
                $item['type'] ?? 'string',
                $item['group'] ?? 'general'
            );
        }

        AuditLog::log('updated', 'Configurações atualizadas');

        return response()->json($saved);
    }

    // ── Audit Logs ──

    public function auditLogs(Request $request): JsonResponse
    {
        $query = AuditLog::with('user:id,name');

        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }
        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($from = $request->get('from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = $request->get('to')) {
            $query->where('created_at', '<=', "$to 23:59:59");
        }
        if ($type = $request->get('auditable_type')) {
            $query->where('auditable_type', 'like', "%$type%");
        }

        $logs = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 50));

        return response()->json($logs);
    }
}
