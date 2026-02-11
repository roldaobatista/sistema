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
        $checklist->delete();

        return response()->json(['message' => 'Checklist excluído com sucesso']);
    }
}
