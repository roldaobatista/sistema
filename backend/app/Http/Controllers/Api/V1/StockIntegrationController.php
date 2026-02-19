<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseQuote;
use App\Models\PurchaseQuoteItem;
use App\Models\PurchaseQuoteSupplier;
use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\AssetTag;
use App\Models\AssetTagScan;
use App\Models\RmaRequest;
use App\Models\RmaItem;
use App\Models\StockDisposal;
use App\Models\StockDisposalItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StockIntegrationController extends Controller
{
    // ═══ COTAÇÃO DE COMPRAS ═══

    public function purchaseQuoteIndex(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $query = PurchaseQuote::where('tenant_id', $tenantId)
            ->with(['items.product:id,name,code', 'suppliers', 'creator:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('reference', 'like', "%{$request->search}%")
                    ->orWhere('title', 'like', "%{$request->search}%");
            });
        }

        return response()->json($query->paginate($request->per_page ?? 20));
    }

    public function purchaseQuoteStore(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $request->validate([
            'title' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'deadline' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => "required|exists:products,id,tenant_id,{$tenantId}",
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.specifications' => 'nullable|string',
            'supplier_ids' => 'nullable|array',
        ]);

        try {
            DB::beginTransaction();

            $tenantId = app('current_tenant_id');
            $lastRef = PurchaseQuote::where('tenant_id', $tenantId)->max('id') ?? 0;
            $reference = 'COT-' . str_pad($lastRef + 1, 6, '0', STR_PAD_LEFT);

            $quote = PurchaseQuote::create([
                'tenant_id' => $tenantId,
                'reference' => $reference,
                'title' => $request->title,
                'notes' => $request->notes,
                'deadline' => $request->deadline,
                'created_by' => $request->user()->id,
            ]);

            foreach ($request->items as $item) {
                $quote->items()->create($item);
            }

            if ($request->supplier_ids) {
                foreach ($request->supplier_ids as $supplierId) {
                    $quote->suppliers()->create(['supplier_id' => $supplierId]);
                }
            }

            DB::commit();
            return response()->json(['message' => 'Cotação criada com sucesso', 'data' => $quote->load('items.product', 'suppliers')], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar cotação', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno'], 500);
        }
    }

    public function purchaseQuoteShow(PurchaseQuote $purchaseQuote): JsonResponse
    {
        $this->authorizeTenant($purchaseQuote);
        return response()->json([
            'data' => $purchaseQuote->load(['items.product:id,name,code,unit,cost_price', 'suppliers', 'creator:id,name']),
        ]);
    }

    public function purchaseQuoteUpdate(Request $request, PurchaseQuote $purchaseQuote): JsonResponse
    {
        $this->authorizeTenant($purchaseQuote);
        $request->validate([
            'status' => 'nullable|in:draft,sent,received,approved,rejected,cancelled',
            'title' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'deadline' => 'nullable|date',
            'approved_supplier_id' => 'nullable|integer',
        ]);

        $purchaseQuote->update(array_filter(
            $request->only(['status', 'title', 'notes', 'deadline', 'approved_supplier_id']),
            fn($v) => $v !== null
        ));
        return response()->json(['message' => 'Cotação atualizada', 'data' => $purchaseQuote->fresh()]);
    }

    public function purchaseQuoteDestroy(PurchaseQuote $purchaseQuote): JsonResponse
    {
        $this->authorizeTenant($purchaseQuote);
        $purchaseQuote->delete();
        return response()->json(['message' => 'Cotação removida']);
    }

    // ═══ SOLICITAÇÃO DE MATERIAL ═══

    public function materialRequestIndex(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $query = MaterialRequest::where('tenant_id', $tenantId)
            ->with(['items.product:id,name,code', 'requester:id,name', 'warehouse:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        return response()->json($query->paginate($request->per_page ?? 20));
    }

    public function materialRequestStore(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $request->validate([
            'warehouse_id' => "nullable|exists:warehouses,id,tenant_id,{$tenantId}",
            'work_order_id' => 'nullable|exists:work_orders,id',
            'priority' => 'nullable|in:low,normal,high,urgent',
            'justification' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => "required|exists:products,id,tenant_id,{$tenantId}",
            'items.*.quantity_requested' => 'required|numeric|min:0.01',
        ]);

        try {
            DB::beginTransaction();

            $tenantId = app('current_tenant_id');
            $lastRef = MaterialRequest::where('tenant_id', $tenantId)->max('id') ?? 0;
            $reference = 'SOL-' . str_pad($lastRef + 1, 6, '0', STR_PAD_LEFT);

            $mr = MaterialRequest::create([
                'tenant_id' => $tenantId,
                'reference' => $reference,
                'requester_id' => $request->user()->id,
                'warehouse_id' => $request->warehouse_id,
                'work_order_id' => $request->work_order_id,
                'priority' => $request->priority ?? 'normal',
                'justification' => $request->justification,
            ]);

            foreach ($request->items as $item) {
                $mr->items()->create($item);
            }

            DB::commit();
            return response()->json(['message' => 'Solicitação criada', 'data' => $mr->load('items.product')], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar solicitação', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno'], 500);
        }
    }

    public function materialRequestShow(MaterialRequest $materialRequest): JsonResponse
    {
        $this->authorizeTenant($materialRequest);
        return response()->json([
            'data' => $materialRequest->load(['items.product:id,name,code,unit,stock_qty', 'requester:id,name', 'approver:id,name', 'warehouse:id,name']),
        ]);
    }

    public function materialRequestUpdate(Request $request, MaterialRequest $materialRequest): JsonResponse
    {
        $this->authorizeTenant($materialRequest);
        $request->validate([
            'status' => 'nullable|in:pending,approved,partially_fulfilled,fulfilled,rejected,cancelled',
            'rejection_reason' => 'nullable|string',
        ]);

        $data = $request->only(['status', 'rejection_reason']);

        if ($request->status === 'approved') {
            $data['approved_by'] = $request->user()->id;
            $data['approved_at'] = now();
        }

        $materialRequest->update($data);
        return response()->json(['message' => 'Solicitação atualizada', 'data' => $materialRequest->fresh()]);
    }

    // ═══ TAGS RFID/QR ═══

    public function assetTagIndex(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $query = AssetTag::where('tenant_id', $tenantId)
            ->with(['lastScanner:id,name'])
            ->orderByDesc('last_scanned_at');

        if ($request->tag_type) {
            $query->where('tag_type', $request->tag_type);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->search) {
            $query->where('tag_code', 'like', "%{$request->search}%");
        }

        return response()->json($query->paginate($request->per_page ?? 20));
    }

    public function assetTagStore(Request $request): JsonResponse
    {
        $request->validate([
            'tag_code' => 'required|string|unique:asset_tags,tag_code',
            'tag_type' => 'required|in:rfid,qrcode,barcode',
            'taggable_type' => 'required|string',
            'taggable_id' => 'required|integer',
            'location' => 'nullable|string',
        ]);

        $tag = AssetTag::create([
            'tenant_id' => app('current_tenant_id'),
            ...$request->only(['tag_code', 'tag_type', 'taggable_type', 'taggable_id', 'location']),
        ]);

        return response()->json(['message' => 'Tag criada', 'data' => $tag], 201);
    }

    public function assetTagScan(Request $request, AssetTag $assetTag): JsonResponse
    {
        $this->authorizeTenant($assetTag);
        $request->validate([
            'action' => 'nullable|string|max:50',
            'location' => 'nullable|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
        ]);

        $scan = $assetTag->scans()->create([
            'scanned_by' => $request->user()->id,
            'action' => $request->action ?? 'scan',
            'location' => $request->location,
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
        ]);

        $assetTag->update([
            'last_scanned_at' => now(),
            'last_scanned_by' => $request->user()->id,
            'location' => $request->location ?? $assetTag->location,
        ]);

        return response()->json(['message' => 'Leitura registrada', 'data' => $scan]);
    }

    public function assetTagShow(AssetTag $assetTag): JsonResponse
    {
        $this->authorizeTenant($assetTag);
        return response()->json([
            'data' => $assetTag->load(['scans' => fn($q) => $q->latest()->limit(50), 'scans.scanner:id,name']),
        ]);
    }

    public function assetTagUpdate(Request $request, AssetTag $assetTag): JsonResponse
    {
        $this->authorizeTenant($assetTag);
        $request->validate([
            'status' => 'nullable|in:active,inactive,lost,damaged',
            'location' => 'nullable|string',
        ]);

        $assetTag->update($request->only(['status', 'location']));
        return response()->json(['message' => 'Tag atualizada', 'data' => $assetTag->fresh()]);
    }

    // ═══ RMA (DEVOLUÇÃO) ═══

    public function rmaIndex(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $query = RmaRequest::where('tenant_id', $tenantId)
            ->with(['items.product:id,name,code', 'creator:id,name', 'customer:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->type) {
            $query->where('type', $request->type);
        }

        return response()->json($query->paginate($request->per_page ?? 20));
    }

    public function rmaStore(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $request->validate([
            'type' => 'required|in:customer_return,supplier_return',
            'customer_id' => 'nullable|exists:customers,id',
            'supplier_id' => 'nullable|integer',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'reason' => 'required|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => "required|exists:products,id,tenant_id,{$tenantId}",
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.defect_description' => 'nullable|string',
            'items.*.condition' => 'nullable|in:new,used,damaged,defective',
        ]);

        try {
            DB::beginTransaction();

            $tenantId = app('current_tenant_id');
            $lastRef = RmaRequest::where('tenant_id', $tenantId)->max('id') ?? 0;
            $rmaNumber = 'RMA-' . str_pad($lastRef + 1, 6, '0', STR_PAD_LEFT);

            $rma = RmaRequest::create([
                'tenant_id' => $tenantId,
                'rma_number' => $rmaNumber,
                'type' => $request->type,
                'customer_id' => $request->customer_id,
                'supplier_id' => $request->supplier_id,
                'work_order_id' => $request->work_order_id,
                'reason' => $request->reason,
                'created_by' => $request->user()->id,
            ]);

            foreach ($request->items as $item) {
                $rma->items()->create($item);
            }

            DB::commit();
            return response()->json(['message' => 'RMA criado com sucesso', 'data' => $rma->load('items.product')], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar RMA', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno'], 500);
        }
    }

    public function rmaShow(RmaRequest $rmaRequest): JsonResponse
    {
        $this->authorizeTenant($rmaRequest);
        return response()->json([
            'data' => $rmaRequest->load(['items.product:id,name,code,unit', 'creator:id,name', 'customer:id,name']),
        ]);
    }

    public function rmaUpdate(Request $request, RmaRequest $rmaRequest): JsonResponse
    {
        $this->authorizeTenant($rmaRequest);
        $request->validate([
            'status' => 'nullable|in:requested,approved,in_transit,received,inspected,resolved,rejected',
            'resolution' => 'nullable|in:refund,replacement,repair,credit,rejected',
            'resolution_notes' => 'nullable|string',
        ]);

        $rmaRequest->update($request->only(['status', 'resolution', 'resolution_notes']));
        return response()->json(['message' => 'RMA atualizado', 'data' => $rmaRequest->fresh()]);
    }

    // ═══ DESCARTE ECOLÓGICO ═══

    public function disposalIndex(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $query = StockDisposal::where('tenant_id', $tenantId)
            ->with(['items.product:id,name,code', 'warehouse:id,name', 'creator:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->disposal_type) {
            $query->where('disposal_type', $request->disposal_type);
        }

        return response()->json($query->paginate($request->per_page ?? 20));
    }

    public function disposalStore(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $request->validate([
            'disposal_type' => 'required|in:expired,damaged,obsolete,recalled,hazardous,other',
            'disposal_method' => 'required|in:recycling,incineration,landfill,donation,return_manufacturer,specialized_treatment',
            'justification' => 'required|string',
            'environmental_notes' => 'nullable|string',
            'warehouse_id' => "nullable|exists:warehouses,id,tenant_id,{$tenantId}",
            'items' => 'required|array|min:1',
            'items.*.product_id' => "required|exists:products,id,tenant_id,{$tenantId}",
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_cost' => 'nullable|numeric|min:0',
            'items.*.batch_id' => "nullable|exists:batches,id,tenant_id,{$tenantId}",
            'items.*.notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $tenantId = app('current_tenant_id');
            $lastRef = StockDisposal::where('tenant_id', $tenantId)->max('id') ?? 0;
            $reference = 'DESC-' . str_pad($lastRef + 1, 6, '0', STR_PAD_LEFT);

            $disposal = StockDisposal::create([
                'tenant_id' => $tenantId,
                'reference' => $reference,
                'disposal_type' => $request->disposal_type,
                'disposal_method' => $request->disposal_method,
                'justification' => $request->justification,
                'environmental_notes' => $request->environmental_notes,
                'warehouse_id' => $request->warehouse_id,
                'created_by' => $request->user()->id,
            ]);

            foreach ($request->items as $item) {
                $disposal->items()->create($item);
            }

            DB::commit();
            return response()->json(['message' => 'Descarte criado com sucesso', 'data' => $disposal->load('items.product')], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar descarte', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno'], 500);
        }
    }

    public function disposalShow(StockDisposal $stockDisposal): JsonResponse
    {
        $this->authorizeTenant($stockDisposal);
        return response()->json([
            'data' => $stockDisposal->load(['items.product:id,name,code,unit', 'items.batch:id,code', 'warehouse:id,name', 'creator:id,name', 'approver:id,name']),
        ]);
    }

    public function disposalUpdate(Request $request, StockDisposal $stockDisposal): JsonResponse
    {
        $this->authorizeTenant($stockDisposal);
        $request->validate([
            'status' => 'nullable|in:pending,approved,in_progress,completed,cancelled',
            'disposal_certificate' => 'nullable|string',
        ]);

        $data = $request->only(['status', 'disposal_certificate']);

        if ($request->status === 'approved') {
            $data['approved_by'] = $request->user()->id;
            $data['approved_at'] = now();
        }
        if ($request->status === 'completed') {
            $data['completed_at'] = now();
        }

        $stockDisposal->update($data);
        return response()->json(['message' => 'Descarte atualizado', 'data' => $stockDisposal->fresh()]);
    }

    private function authorizeTenant($model): void
    {
        $tenantId = (int) app('current_tenant_id');
        if ($model->tenant_id !== $tenantId) {
            abort(403, 'Acesso não autorizado a este recurso.');
        }
    }
}
