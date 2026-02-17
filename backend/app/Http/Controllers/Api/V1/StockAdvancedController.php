<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StockAdvancedController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1. PURCHASE QUOTATIONS (Cotação de Compras)
    // ═══════════════════════════════════════════════════════════════════

    public function purchaseQuotations(Request $request): JsonResponse
    {
        $data = DB::table('purchase_quotations')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storePurchaseQuotation(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $validated = $request->validate([
            'supplier_id' => ['required', \Illuminate\Validation\Rule::exists('suppliers', 'id')->where('tenant_id', $tenantId)],
            'items' => 'required|array|min:1',
            'items.*.product_id' => ['required', \Illuminate\Validation\Rule::exists('products', 'id')->where('tenant_id', $tenantId)],
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
            'valid_until' => 'nullable|date',
        ]);

        try {
            DB::beginTransaction();

            $total = collect($validated['items'])->sum(fn($i) => $i['quantity'] * $i['unit_price']);

            $id = DB::table('purchase_quotations')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'supplier_id' => $validated['supplier_id'],
                'total' => $total,
                'status' => 'pending',
                'notes' => $validated['notes'] ?? null,
                'valid_until' => $validated['valid_until'] ?? null,
                'created_by' => auth()->id(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($validated['items'] as $item) {
                DB::table('purchase_quotation_items')->insert([
                    'purchase_quotation_id' => $id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'total' => $item['quantity'] * $item['unit_price'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::commit();
            return response()->json(['message' => 'Cotação criada com sucesso', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Purchase quotation creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar cotação'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. STOCK TRANSFERS (Transferências de Estoque)
    // ═══════════════════════════════════════════════════════════════════

    public function stockTransfers(Request $request): JsonResponse
    {
        $data = DB::table('stock_transfers')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function suggestTransfers(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();

        // Find products with excess in one warehouse and deficit in another
        $suggestions = DB::select("
            SELECT
                ws1.product_id,
                p.name as product_name,
                ws1.warehouse_id as from_warehouse,
                w1.name as from_warehouse_name,
                ws1.quantity as from_quantity,
                ws2.warehouse_id as to_warehouse,
                w2.name as to_warehouse_name,
                ws2.quantity as to_quantity,
                LEAST(ws1.quantity - p.stock_min, p.stock_min - ws2.quantity) as suggested_qty
            FROM warehouse_stocks ws1
            JOIN warehouse_stocks ws2 ON ws1.product_id = ws2.product_id AND ws1.warehouse_id != ws2.warehouse_id
            JOIN products p ON p.id = ws1.product_id
            JOIN warehouses w1 ON w1.id = ws1.warehouse_id
            JOIN warehouses w2 ON w2.id = ws2.warehouse_id
            WHERE w1.tenant_id = ?
              AND ws1.quantity > COALESCE(p.stock_min, 0) * 1.5
              AND ws2.quantity < COALESCE(p.stock_min, 0)
            ORDER BY (COALESCE(p.stock_min, 0) - ws2.quantity) DESC
            LIMIT 20
        ", [$tenantId]);

        return response()->json(['data' => $suggestions]);
    }

    public function storeTransfer(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $validated = $request->validate([
            'from_warehouse_id' => ['required', \Illuminate\Validation\Rule::exists('warehouses', 'id')->where('tenant_id', $tenantId)],
            'to_warehouse_id' => ['required', 'different:from_warehouse_id', \Illuminate\Validation\Rule::exists('warehouses', 'id')->where('tenant_id', $tenantId)],
            'items' => 'required|array|min:1',
            'items.*.product_id' => ['required', \Illuminate\Validation\Rule::exists('products', 'id')->where('tenant_id', $tenantId)],
            'items.*.quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string',
        ]);

        try {
            $service = app(\App\Services\StockTransferService::class);
            $transfer = $service->createTransfer(
                fromWarehouseId: $validated['from_warehouse_id'],
                toWarehouseId: $validated['to_warehouse_id'],
                items: $validated['items'],
                notes: $validated['notes'] ?? null,
                createdBy: auth()->id(),
            );

            return response()->json([
                'message' => 'Transferência realizada com sucesso',
                'data' => $transfer,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Stock transfer failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro na transferência'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. SERIAL NUMBER TRACKING (Rastreamento de Número de Série)
    // ═══════════════════════════════════════════════════════════════════

    public function serialNumbers(Request $request): JsonResponse
    {
        $data = DB::table('serial_numbers')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('product_id'), fn($q, $p) => $q->where('product_id', $p))
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->when($request->input('search'), fn($q, $s) => $q->where('serial', 'like', "%{$s}%"))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storeSerialNumber(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $validated = $request->validate([
            'product_id' => ['required', \Illuminate\Validation\Rule::exists('products', 'id')->where('tenant_id', $tenantId)],
            'serial' => 'required|string|max:100',
            'status' => 'nullable|in:available,in_use,returned,defective',
            'notes' => 'nullable|string',
        ]);

        try {
            $exists = DB::table('serial_numbers')
                ->where('tenant_id', $this->tenantId())
                ->where('serial', $validated['serial'])
                ->exists();

            if ($exists) {
                return response()->json(['message' => 'Número de série já cadastrado'], 422);
            }

            DB::beginTransaction();

            $id = DB::table('serial_numbers')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'product_id' => $validated['product_id'],
                'serial' => $validated['serial'],
                'status' => $validated['status'] ?? 'available',
                'notes' => $validated['notes'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Número de série registrado', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Serial number creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar número de série'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. MATERIAL REQUESTS (Solicitação de Material)
    // ═══════════════════════════════════════════════════════════════════

    public function materialRequests(Request $request): JsonResponse
    {
        $data = DB::table('material_requests')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storeMaterialRequest(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $validated = $request->validate([
            'work_order_id' => ['nullable', \Illuminate\Validation\Rule::exists('work_orders', 'id')->where('tenant_id', $tenantId)],
            'items' => 'required|array|min:1',
            'items.*.product_id' => ['required', \Illuminate\Validation\Rule::exists('products', 'id')->where('tenant_id', $tenantId)],
            'items.*.quantity' => 'required|numeric|min:0.01',
            'urgency' => 'nullable|in:low,normal,high,critical',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('material_requests')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'work_order_id' => $validated['work_order_id'] ?? null,
                'requested_by' => auth()->id(),
                'status' => 'pending',
                'urgency' => $validated['urgency'] ?? 'normal',
                'notes' => $validated['notes'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($validated['items'] as $item) {
                DB::table('material_request_items')->insert([
                    'material_request_id' => $id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'created_at' => now(),
                ]);
            }

            DB::commit();
            return response()->json(['message' => 'Solicitação criada com sucesso', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Material request creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar solicitação'], 500);
        }
    }

    public function approveMaterialRequest(int $id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $updated = DB::table('material_requests')
                ->where('id', $id)
                ->where('tenant_id', $this->tenantId())
                ->update(['status' => 'approved', 'approved_by' => auth()->id(), 'updated_at' => now()]);

            if (!$updated) {
                DB::rollBack();
                return response()->json(['message' => 'Solicitação não encontrada'], 404);
            }

            DB::commit();
            return response()->json(['message' => 'Solicitação aprovada com sucesso']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Material request approval failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao aprovar solicitação'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. RMA (Return Merchandise Authorization)
    // ═══════════════════════════════════════════════════════════════════

    public function rmaList(Request $request): JsonResponse
    {
        $data = DB::table('rma_requests')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storeRma(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $validated = $request->validate([
            'product_id' => ['required', \Illuminate\Validation\Rule::exists('products', 'id')->where('tenant_id', $tenantId)],
            'serial_number' => 'nullable|string|max:100',
            'customer_id' => ['nullable', \Illuminate\Validation\Rule::exists('customers', 'id')->where('tenant_id', $tenantId)],
            'work_order_id' => ['nullable', \Illuminate\Validation\Rule::exists('work_orders', 'id')->where('tenant_id', $tenantId)],
            'reason' => 'required|string|max:500',
            'quantity' => 'required|integer|min:1',
            'action' => 'required|in:replace,repair,refund',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('rma_requests')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'product_id' => $validated['product_id'],
                'serial_number' => $validated['serial_number'] ?? null,
                'customer_id' => $validated['customer_id'] ?? null,
                'work_order_id' => $validated['work_order_id'] ?? null,
                'reason' => $validated['reason'],
                'quantity' => $validated['quantity'],
                'action' => $validated['action'],
                'status' => 'open',
                'created_by' => auth()->id(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'RMA criado com sucesso', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('RMA creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar RMA'], 500);
        }
    }

    public function updateRmaStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:open,in_progress,resolved,closed',
            'resolution_notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $updated = DB::table('rma_requests')
                ->where('id', $id)
                ->where('tenant_id', $this->tenantId())
                ->update([
                    'status' => $validated['status'],
                    'resolution_notes' => $validated['resolution_notes'] ?? null,
                    'resolved_at' => in_array($validated['status'], ['resolved', 'closed']) ? now() : null,
                    'updated_at' => now(),
                ]);

            if (!$updated) {
                DB::rollBack();
                return response()->json(['message' => 'RMA não encontrado'], 404);
            }

            DB::commit();
            return response()->json(['message' => 'Status RMA atualizado com sucesso']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('RMA status update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar RMA'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. ASSET TAGS (RFID/QR)
    // ═══════════════════════════════════════════════════════════════════

    public function assetTags(Request $request): JsonResponse
    {
        $data = DB::table('asset_tags')
            ->where('tenant_id', $this->tenantId())
            ->when($request->input('search'), fn($q, $s) => $q->where('tag_code', 'like', "%{$s}%"))
            ->when($request->input('type'), fn($q, $t) => $q->where('tag_type', $t))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storeAssetTag(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $validated = $request->validate([
            'product_id' => ['required', \Illuminate\Validation\Rule::exists('products', 'id')->where('tenant_id', $tenantId)],
            'tag_code' => ['required', 'string', 'max:100', \Illuminate\Validation\Rule::unique('asset_tags', 'tag_code')->where('tenant_id', $tenantId)],
            'tag_type' => 'required|in:rfid,qr,barcode',
            'location' => 'nullable|string|max:255',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('asset_tags')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'product_id' => $validated['product_id'],
                'tag_code' => $validated['tag_code'],
                'tag_type' => $validated['tag_type'],
                'location' => $validated['location'] ?? null,
                'last_scanned_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Tag registrada com sucesso', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Asset tag creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar tag'], 500);
        }
    }

    public function scanAssetTag(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tag_code' => 'required|string',
        ]);

        try {
            $tag = DB::table('asset_tags')
                ->where('tenant_id', $this->tenantId())
                ->where('tag_code', $validated['tag_code'])
                ->first();

            if (!$tag) {
                return response()->json(['message' => 'Tag não encontrada'], 404);
            }

            DB::table('asset_tags')->where('id', $tag->id)
                ->update(['last_scanned_at' => now(), 'updated_at' => now()]);

            $product = Product::find($tag->product_id);

            return response()->json([
                'data' => [
                    'tag' => $tag,
                    'product' => $product,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Asset tag scan failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao escanear tag'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. ECOLOGICAL DISPOSAL (Descarte Ecológico)
    // ═══════════════════════════════════════════════════════════════════

    public function ecologicalDisposals(Request $request): JsonResponse
    {
        $data = DB::table('ecological_disposals')
            ->where('tenant_id', $this->tenantId())
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($data);
    }

    public function storeEcologicalDisposal(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId();
        $validated = $request->validate([
            'product_id' => ['required', \Illuminate\Validation\Rule::exists('products', 'id')->where('tenant_id', $tenantId)],
            'quantity' => 'required|numeric|min:0.01',
            'disposal_method' => 'required|in:recycling,incineration,donation,return_to_supplier,special_waste',
            'disposal_company' => 'nullable|string|max:255',
            'certificate_number' => 'nullable|string|max:100',
            'reason' => 'required|string|max:500',
            'notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $id = DB::table('ecological_disposals')->insertGetId([
                'tenant_id' => $this->tenantId(),
                'product_id' => $validated['product_id'],
                'quantity' => $validated['quantity'],
                'disposal_method' => $validated['disposal_method'],
                'disposal_company' => $validated['disposal_company'] ?? null,
                'certificate_number' => $validated['certificate_number'] ?? null,
                'reason' => $validated['reason'],
                'notes' => $validated['notes'] ?? null,
                'disposed_by' => auth()->id(),
                'disposed_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json(['message' => 'Descarte registrado com sucesso', 'id' => $id], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Ecological disposal creation failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao registrar descarte'], 500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. XML INVOICE IMPORT (Importar NF-e via XML)
    // ═══════════════════════════════════════════════════════════════════

    public function importNfeXml(Request $request): JsonResponse
    {
        $request->validate([
            'xml_file' => 'required|file|mimes:xml|max:5120',
        ]);

        try {
            $xml = simplexml_load_string(file_get_contents($request->file('xml_file')->path()));

            if (!$xml) {
                return response()->json(['message' => 'XML inválido'], 422);
            }

            $ns = $xml->getNamespaces(true);
            $nfe = $xml->children($ns[''] ?? '');

            $infNFe = $nfe->NFe->infNFe ?? $nfe->infNFe ?? null;
            if (!$infNFe) {
                return response()->json(['message' => 'Estrutura XML não reconhecida'], 422);
            }

            $emit = $infNFe->emit;
            $items = [];

            foreach ($infNFe->det as $det) {
                $prod = $det->prod;
                $items[] = [
                    'code' => (string) $prod->cProd,
                    'description' => (string) $prod->xProd,
                    'ncm' => (string) $prod->NCM,
                    'unit' => (string) $prod->uCom,
                    'quantity' => (float) $prod->qCom,
                    'unit_price' => (float) $prod->vUnCom,
                    'total' => (float) $prod->vProd,
                ];
            }

            $total = $infNFe->total->ICMSTot;

            return response()->json([
                'data' => [
                    'nfe_number' => (string) $infNFe->ide->nNF,
                    'nfe_key' => (string) ($infNFe->attributes()->Id ?? ''),
                    'emission_date' => (string) $infNFe->ide->dhEmi,
                    'supplier' => [
                        'cnpj' => (string) $emit->CNPJ,
                        'name' => (string) $emit->xNome,
                    ],
                    'items' => $items,
                    'totals' => [
                        'products' => (float) ($total->vProd ?? 0),
                        'freight' => (float) ($total->vFrete ?? 0),
                        'discount' => (float) ($total->vDesc ?? 0),
                        'nfe_total' => (float) ($total->vNF ?? 0),
                    ],
                    'item_count' => count($items),
                ],
                'message' => 'XML importado com sucesso. Revise os itens antes de confirmar.',
            ]);
        } catch (\Exception $e) {
            Log::error('NF-e XML import failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao processar XML: ' . $e->getMessage()], 500);
        }
    }
}
