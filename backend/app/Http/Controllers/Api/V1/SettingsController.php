<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

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

        try {
            $saved = DB::transaction(function () use ($validated) {
                $saved = [];
                foreach ($validated['settings'] as $item) {
                    if (($item['key'] ?? '') === 'quote_sequence_start') {
                        $start = filter_var($item['value'], FILTER_VALIDATE_INT);
                        if ($start === false || (int) $start < 1) {
                            throw ValidationException::withMessages([
                                'settings' => 'quote_sequence_start deve ser um inteiro maior ou igual a 1.',
                            ]);
                        }
                    }

                    $saved[] = SystemSetting::setValue(
                        $item['key'],
                        $item['value'],
                        $item['type'] ?? 'string',
                        $item['group'] ?? 'general'
                    );
                }
                return $saved;
            });

            AuditLog::log('updated', 'Configurações atualizadas');

            return response()->json($saved);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('Settings update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar configurações'], 500);
        }
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
        if ($type = $request->get('auditable_type')) {
            $query->where('auditable_type', 'like', '%' . $type . '%');
        }
        if ($auditableId = $request->get('auditable_id')) {
            $query->where('auditable_id', $auditableId);
        }
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('old_values', 'like', "%{$search}%")
                  ->orWhere('new_values', 'like', "%{$search}%");
            });
        }
        if ($from = $request->get('from') ?? $request->get('date_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('to') ?? $request->get('date_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $logs = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 50));

        return response()->json($logs);
    }
}
