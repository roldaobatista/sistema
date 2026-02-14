<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FollowUp;
use App\Models\PriceTable;
use App\Models\PriceTableItem;
use App\Models\CustomerDocument;
use App\Models\CostCenter;
use App\Models\CollectionRule;
use App\Models\RoutePlan;
use App\Models\WorkOrderRating;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AdvancedFeaturesController extends Controller
{
    // ─── FOLLOW-UPS ──────────────────────────────────────────────

    public function indexFollowUps(Request $request): JsonResponse
    {
        $query = FollowUp::where('tenant_id', $request->user()->tenant_id)
            ->with(['assignedTo:id,name', 'followable']);

        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('assigned_to')) $query->where('assigned_to', $request->assigned_to);
        if ($request->filled('overdue')) {
            $query->where('status', 'pending')->where('scheduled_at', '<', now());
        }

        return response()->json($query->orderBy('scheduled_at')->paginate($request->input('per_page', 20)));
    }

    public function storeFollowUp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'followable_type' => 'required|string',
            'followable_id' => 'required|integer',
            'assigned_to' => 'required|exists:users,id',
            'scheduled_at' => 'required|date',
            'channel' => 'nullable|in:phone,whatsapp,email,visit',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $followUp = FollowUp::create($validated);
            DB::commit();
            return response()->json(['message' => 'Follow-up agendado', 'data' => $followUp], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('FollowUp create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao agendar follow-up'], 500);
        }
    }

    public function completeFollowUp(Request $request, FollowUp $followUp): JsonResponse
    {
        $validated = $request->validate([
            'result' => 'required|in:interested,not_now,lost,converted',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $followUp->update([
                'status' => 'completed',
                'completed_at' => now(),
                'result' => $validated['result'],
                'notes' => $validated['notes'] ?? $followUp->notes,
            ]);
            DB::commit();
            return response()->json(['message' => 'Follow-up concluído', 'data' => $followUp->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao concluir'], 500);
        }
    }

    // ─── PRICE TABLES ────────────────────────────────────────────

    public function indexPriceTables(Request $request): JsonResponse
    {
        return response()->json(
            PriceTable::where('tenant_id', $request->user()->tenant_id)
                ->withCount('items')
                ->orderBy('name')
                ->paginate($request->input('per_page', 20))
        );
    }

    public function storePriceTable(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'region' => 'nullable|string|max:100',
            'customer_type' => 'nullable|in:government,industry,commerce,agro',
            'multiplier' => 'nullable|numeric|min:0.0001|max:99.9999',
            'is_default' => 'nullable|boolean',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date|after:valid_from',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;

            if ($validated['is_default'] ?? false) {
                PriceTable::where('tenant_id', $validated['tenant_id'])->update(['is_default' => false]);
            }

            $table = PriceTable::create($validated);
            DB::commit();
            return response()->json(['message' => 'Tabela de preços criada', 'data' => $table], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao criar tabela'], 500);
        }
    }

    public function showPriceTable(PriceTable $priceTable): JsonResponse
    {
        $priceTable->load('items.priceable');
        return response()->json(['data' => $priceTable]);
    }

    public function updatePriceTable(Request $request, PriceTable $priceTable): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'region' => 'nullable|string|max:100',
            'customer_type' => 'nullable|in:government,industry,commerce,agro',
            'multiplier' => 'nullable|numeric|min:0.0001|max:99.9999',
            'is_default' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date',
        ]);

        try {
            DB::beginTransaction();
            if ($validated['is_default'] ?? false) {
                PriceTable::where('tenant_id', $priceTable->tenant_id)->where('id', '!=', $priceTable->id)->update(['is_default' => false]);
            }
            $priceTable->update($validated);
            DB::commit();
            return response()->json(['message' => 'Tabela atualizada', 'data' => $priceTable->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar'], 500);
        }
    }

    public function destroyPriceTable(PriceTable $priceTable): JsonResponse
    {
        try {
            DB::beginTransaction();
            $priceTable->items()->delete();
            $priceTable->delete();
            DB::commit();
            return response()->json(['message' => 'Tabela removida']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao remover'], 500);
        }
    }

    // ─── CUSTOMER DOCUMENTS ──────────────────────────────────────

    public function indexCustomerDocuments(Request $request, int $customerId): JsonResponse
    {
        return response()->json(
            CustomerDocument::where('tenant_id', $request->user()->tenant_id)
                ->where('customer_id', $customerId)
                ->with('uploader:id,name')
                ->orderByDesc('created_at')
                ->paginate($request->input('per_page', 20))
        );
    }

    public function storeCustomerDocument(Request $request, int $customerId): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'nullable|in:contract,alvara,avcb,license,other',
            'file' => 'required|file|max:10240',
            'expiry_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $file = $request->file('file');
            $path = $file->store("customer-documents/{$customerId}", 'public');

            $doc = CustomerDocument::create([
                'tenant_id' => $request->user()->tenant_id,
                'customer_id' => $customerId,
                'title' => $validated['title'],
                'type' => $validated['type'] ?? 'other',
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'expiry_date' => $validated['expiry_date'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'uploaded_by' => $request->user()->id,
            ]);

            DB::commit();
            return response()->json(['message' => 'Documento enviado', 'data' => $doc], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('CustomerDocument upload failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao enviar documento'], 500);
        }
    }

    public function destroyCustomerDocument(CustomerDocument $document): JsonResponse
    {
        try {
            DB::beginTransaction();
            \Illuminate\Support\Facades\Storage::disk('public')->delete($document->file_path);
            $document->delete();
            DB::commit();
            return response()->json(['message' => 'Documento removido']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao remover documento'], 500);
        }
    }

    // ─── COST CENTERS ────────────────────────────────────────────

    public function indexCostCenters(Request $request): JsonResponse
    {
        return response()->json(
            CostCenter::where('tenant_id', $request->user()->tenant_id)
                ->with('children')
                ->whereNull('parent_id')
                ->orderBy('code')
                ->get()
        );
    }

    public function storeCostCenter(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:20',
            'parent_id' => 'nullable|exists:cost_centers,id',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $center = CostCenter::create($validated);
            DB::commit();
            return response()->json(['message' => 'Centro de custo criado', 'data' => $center], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao criar'], 500);
        }
    }

    public function updateCostCenter(Request $request, CostCenter $costCenter): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:20',
            'parent_id' => 'nullable|exists:cost_centers,id',
            'is_active' => 'nullable|boolean',
        ]);

        try {
            DB::beginTransaction();
            $costCenter->update($validated);
            DB::commit();
            return response()->json(['message' => 'Centro de custo atualizado', 'data' => $costCenter->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar'], 500);
        }
    }

    public function destroyCostCenter(CostCenter $costCenter): JsonResponse
    {
        if ($costCenter->children()->exists()) {
            return response()->json(['message' => 'Não é possível remover um centro de custo com filhos'], 409);
        }

        try {
            DB::beginTransaction();
            $costCenter->delete();
            DB::commit();
            return response()->json(['message' => 'Centro de custo removido']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao remover'], 500);
        }
    }

    // ─── COLLECTION RULES ────────────────────────────────────────

    public function indexCollectionRules(Request $request): JsonResponse
    {
        return response()->json(
            CollectionRule::where('tenant_id', $request->user()->tenant_id)
                ->orderBy('name')
                ->paginate($request->input('per_page', 20))
        );
    }

    public function storeCollectionRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'steps' => 'required|array|min:1',
            'steps.*.days_offset' => 'required|integer',
            'steps.*.channel' => 'required|in:email,whatsapp,sms,phone',
            'steps.*.message_template' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $rule = CollectionRule::create($validated);
            DB::commit();
            return response()->json(['message' => 'Régua de cobrança criada', 'data' => $rule], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao criar'], 500);
        }
    }

    public function updateCollectionRule(Request $request, CollectionRule $rule): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'steps' => 'sometimes|array|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        try {
            DB::beginTransaction();
            $rule->update($validated);
            DB::commit();
            return response()->json(['message' => 'Régua atualizada', 'data' => $rule->fresh()]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao atualizar'], 500);
        }
    }

    // ─── ROUTE PLANS ─────────────────────────────────────────────

    public function indexRoutePlans(Request $request): JsonResponse
    {
        $query = RoutePlan::where('tenant_id', $request->user()->tenant_id)
            ->with('technician:id,name');

        if ($request->filled('technician_id')) $query->where('technician_id', $request->technician_id);
        if ($request->filled('date')) $query->where('plan_date', $request->date);

        return response()->json($query->orderByDesc('plan_date')->paginate($request->input('per_page', 20)));
    }

    public function storeRoutePlan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'technician_id' => 'required|exists:users,id',
            'plan_date' => 'required|date',
            'stops' => 'required|array|min:1',
            'total_distance_km' => 'nullable|numeric|min:0',
            'estimated_duration_min' => 'nullable|integer|min:0',
        ]);

        try {
            DB::beginTransaction();
            $validated['tenant_id'] = $request->user()->tenant_id;
            $plan = RoutePlan::create($validated);
            DB::commit();
            return response()->json(['message' => 'Rota planejada', 'data' => $plan], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao planejar rota'], 500);
        }
    }

    // ─── WORK ORDER RATINGS (public endpoint for clients) ────────

    public function submitRating(Request $request, string $token): JsonResponse
    {
        $workOrder = \App\Models\WorkOrder::where('rating_token', $token)->firstOrFail();

        $existingRating = WorkOrderRating::where('work_order_id', $workOrder->id)->first();
        if ($existingRating) {
            return response()->json(['message' => 'Avaliação já registrada'], 422);
        }

        $validated = $request->validate([
            'overall_rating' => 'required|integer|min:1|max:5',
            'quality_rating' => 'nullable|integer|min:1|max:5',
            'punctuality_rating' => 'nullable|integer|min:1|max:5',
            'comment' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();
            $rating = WorkOrderRating::create([
                ...$validated,
                'work_order_id' => $workOrder->id,
                'customer_id' => $workOrder->customer_id,
                'channel' => 'link',
            ]);
            DB::commit();
            return response()->json(['message' => 'Obrigado pela avaliação!', 'data' => $rating], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro ao registrar avaliação'], 500);
        }
    }
}
