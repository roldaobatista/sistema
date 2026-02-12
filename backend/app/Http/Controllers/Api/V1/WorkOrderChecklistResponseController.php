<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Models\WorkOrderChecklistResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkOrderChecklistResponseController extends Controller
{
    private function tenantId(Request $request): int
    {
        $user = $request->user();

        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function store(Request $request, int $workOrderId): JsonResponse
    {
        $workOrder = WorkOrder::where('tenant_id', $this->tenantId($request))->findOrFail($workOrderId);

        if (!$workOrder->checklist_id) {
            return response()->json([
                'message' => 'A OS não possui checklist vinculado.',
            ], 422);
        }

        $data = $request->validate([
            'responses' => 'required|array',
            'responses.*.checklist_item_id' => ['required', 'integer'],
            'responses.*.value' => 'nullable|string',
            'responses.*.notes' => 'nullable|string',
        ]);

        $itemIds = collect($data['responses'])
            ->pluck('checklist_item_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique();

        $validItemIds = DB::table('service_checklist_items')
            ->where('checklist_id', $workOrder->checklist_id)
            ->whereIn('id', $itemIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $validMap = array_flip($validItemIds);
        $invalidIndexes = [];

        foreach ($data['responses'] as $index => $response) {
            $itemId = (int) ($response['checklist_item_id'] ?? 0);
            if (!isset($validMap[$itemId])) {
                $invalidIndexes[] = $index;
            }
        }

        if (!empty($invalidIndexes)) {
            $errors = [];
            foreach ($invalidIndexes as $index) {
                $errors["responses.{$index}.checklist_item_id"] = ['Checklist item inválido para a OS selecionada.'];
            }

            return response()->json([
                'message' => 'Um ou mais itens não pertencem ao checklist desta OS.',
                'errors' => $errors,
            ], 422);
        }

        try {
            DB::transaction(function () use ($workOrder, $data) {
                foreach ($data['responses'] as $response) {
                    WorkOrderChecklistResponse::updateOrCreate(
                        [
                            'work_order_id' => $workOrder->id,
                            'checklist_item_id' => $response['checklist_item_id'],
                        ],
                        [
                            'value' => $response['value'],
                            'notes' => $response['notes'] ?? null,
                        ]
                    );
                }
            });

            return response()->json(['message' => 'Respostas do checklist salvas com sucesso.']);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('ChecklistResponse store failed', [
                'wo_id' => $workOrder->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Erro ao salvar respostas do checklist'], 500);
        }
    }

    public function index(Request $request, int $workOrderId): JsonResponse
    {
        $workOrder = WorkOrder::where('tenant_id', $this->tenantId($request))->findOrFail($workOrderId);
        $responses = $workOrder->checklistResponses()->with('item')->get();

        return response()->json(['data' => $responses]);
    }
}
