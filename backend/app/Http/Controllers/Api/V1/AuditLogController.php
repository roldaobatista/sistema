<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{
    private function baseQuery()
    {
        $tenantId = app()->bound('current_tenant_id') ? (int) app('current_tenant_id') : null;

        return AuditLog::with('user')
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->where(function ($query) {
                $query->whereNull('auditable_type')
                    ->orWhereNotIn('auditable_type', [Tenant::class, User::class]);
            })
            ->orderByDesc('created_at');
    }

    /**
     * GET /audit-logs — paginated list with advanced filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = $this->baseQuery();

        // Filters
        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->filled('auditable_type')) {
            $type = $request->input('auditable_type');
            $query->where('auditable_type', 'LIKE', "%{$type}%");
        }

        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->input('to') . ' 23:59:59');
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('description', 'LIKE', "%{$search}%");
        }

        $perPage = min((int)$request->input('per_page', 30), 100);

        return response()->json(
            $query->paginate($perPage)
        );
    }

    /**
     * GET /audit-logs/{id} — single entry with diff data.
     */
    public function show(int $id): JsonResponse
    {
        $log = AuditLog::with('user')->findOrFail($id);

        $diff = [];
        $old = $log->old_values ?? [];
        $new = $log->new_values ?? [];
        $allKeys = array_unique(array_merge(array_keys($old), array_keys($new)));

        foreach ($allKeys as $key) {
            $oldVal = $old[$key] ?? null;
            $newVal = $new[$key] ?? null;
            if ($oldVal !== $newVal) {
                $diff[] = [
                    'field' => $key,
                    'old' => $oldVal,
                    'new' => $newVal,
                ];
            }
        }

        return response()->json([
            'data' => $log,
            'diff' => $diff,
        ]);
    }

    /**
     * GET /audit-logs/actions — list distinct actions for filter dropdown.
     */
    public function actions(): JsonResponse
    {
        $actions = $this->baseQuery()
            ->distinct('action')
            ->pluck('action');

        return response()->json(['data' => $actions]);
    }

    /**
     * GET /audit-logs/entity-types — list distinct entity types.
     */
    public function entityTypes(): JsonResponse
    {
        $types = $this->baseQuery()
            ->distinct('auditable_type')
            ->pluck('auditable_type')
            ->filter()
            ->map(fn($t) => [
                'value' => $t,
                'label' => class_basename($t),
            ])
            ->values();

        return response()->json(['data' => $types]);
    }

    /**
     * POST /audit-logs/export — export filtered audit logs as CSV.
     */
    public function export(Request $request): StreamedResponse
    {
        $query = $this->baseQuery();

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }
        if ($request->filled('auditable_type')) {
            $query->where('auditable_type', 'LIKE', "%{$request->input('auditable_type')}%");
        }
        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->input('to') . ' 23:59:59');
        }

        $filename = 'audit_log_' . now()->format('Y-m-d_His') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Data', 'Usuário', 'Ação', 'Entidade', 'ID', 'Descrição', 'IP'], ';');

            $query->chunk(500, function ($logs) use ($handle) {
                foreach ($logs as $log) {
                    fputcsv($handle, [
                        $log->created_at?->format('d/m/Y H:i:s'),
                        $log->user?->name ?? 'Sistema',
                        AuditLog::ACTIONS[$log->action] ?? $log->action,
                        $log->auditable_type ? class_basename($log->auditable_type) : '-',
                        $log->auditable_id ?? '-',
                        $log->description,
                        $log->ip_address,
                    ], ';');
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
