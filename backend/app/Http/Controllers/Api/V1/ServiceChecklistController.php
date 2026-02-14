<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ServiceChecklist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ServiceChecklistController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $checklists = ServiceChecklist::where('tenant_id', $this->tenantId($request))
            ->with('items')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $checklists]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'items' => 'array',
            'items.*.description' => 'required|string',
            'items.*.type' => 'required|string|in:check,text,number,photo,yes_no',
            'items.*.is_required' => 'boolean',
            'items.*.order_index' => 'integer',
        ]);

        try {
            $checklist = DB::transaction(function () use ($data, $request) {
                $checklist = ServiceChecklist::create([
                    'tenant_id' => $this->tenantId($request),
                    'name' => $data['name'],
                    'description' => $data['description'] ?? null,
                    'is_active' => $data['is_active'] ?? true,
                ]);

                if (!empty($data['items'])) {
                    foreach ($data['items'] as $itemData) {
                        $checklist->items()->create($itemData);
                    }
                }
                return $checklist;
            });

            return response()->json(['data' => $checklist->load('items')], 201);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ServiceChecklist store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar checklist'], 500);
        }
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $checklist = ServiceChecklist::where('tenant_id', $this->tenantId($request))
            ->with('items')
            ->findOrFail($id);

        return response()->json(['data' => $checklist]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $checklist = ServiceChecklist::where('tenant_id', $this->tenantId($request))->findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'items' => 'array', // Full replace of items logic for simplicity in V1
        ]);

        DB::transaction(function () use ($checklist, $data) {
            $checklist->update($data);

            if (isset($data['items'])) {
                $checklist->items()->delete(); // Remove old
                foreach ($data['items'] as $itemData) {
                    $checklist->items()->create($itemData);
                }
            }
        });

        return response()->json(['data' => $checklist->load('items')]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $checklist = ServiceChecklist::where('tenant_id', $this->tenantId($request))->findOrFail($id);

        // Verificar dependências
        $woCount = \App\Models\WorkOrder::where('checklist_id', $checklist->id)->count();
        if ($woCount > 0) {
            return response()->json([
                'message' => "Não é possível excluir. Este checklist está vinculado a {$woCount} ordem(ns) de serviço.",
            ], 409);
        }

        try {
            DB::transaction(function () use ($checklist) {
                $checklist->items()->delete();
                $checklist->delete();
            });
            return response()->json(['message' => 'Checklist excluído com sucesso']);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ServiceChecklist destroy failed', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir checklist'], 500);
        }
    }
}
