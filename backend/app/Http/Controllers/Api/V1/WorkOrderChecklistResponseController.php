<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Models\WorkOrderChecklistResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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
            'responses.*.checklist_item_id' => [
                'required', 'integer',
                Rule::exists('service_checklist_items', 'id')->where('checklist_id', $workOrder->checklist_id),
            ],
            'responses.*.value' => 'nullable|string', // pode ser texto, booleano stringify, path foto
            'responses.*.notes' => 'nullable|string',
        ]);

        $itemIds = collect($data['responses'])->pluck('checklist_item_id')->filter()->map(fn ($id) => (int) $id)->unique();
        $validItemsCount = DB::table('service_checklist_items')
            ->where('checklist_id', $workOrder->checklist_id)
            ->whereIn('id', $itemIds)
            ->count();

        if ($validItemsCount !== $itemIds->count()) {
            return response()->json([
                'message' => 'Um ou mais itens não pertencem ao checklist desta OS.',
                'errors' => ['responses' => ['Checklist item inválido para a OS selecionada.']],
            ], 422);
        }

        DB::transaction(function () use ($workOrder, $data) {
            // Remove respostas anteriores para evitar duplicidade ou inconsistência (Full rewrite strategy for simplicity)
            // Ou poderia usar updateOrCreate por item_id. Vamos de updateOrCreate.
            
            foreach ($data['responses'] as $resp) {
                WorkOrderChecklistResponse::updateOrCreate(
                    [
                        'work_order_id' => $workOrder->id,
                        'checklist_item_id' => $resp['checklist_item_id'],
                    ],
                    [
                        'value' => $resp['value'],
                        'notes' => $resp['notes'] ?? null,
                    ]
                );
            }
        });

        return response()->json(['message' => 'Respostas do checklist salvas com sucesso.']);
    }

    public function index(Request $request, int $workOrderId): JsonResponse
    {
        $workOrder = WorkOrder::where('tenant_id', $this->tenantId($request))->findOrFail($workOrderId);
        
        $responses = $workOrder->checklistResponses()->with('item')->get();

        return response()->json(['data' => $responses]);
    }
}
