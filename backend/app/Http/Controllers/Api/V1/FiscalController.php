<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FiscalEvent;
use App\Models\FiscalNote;
use App\Models\WorkOrder;
use App\Models\Quote;
use App\Services\Fiscal\FiscalProvider;
use App\Services\Fiscal\ContingencyService;
use App\Services\Fiscal\FiscalEmailService;
use App\Services\Fiscal\FiscalNumberingService;
use App\Services\Fiscal\FocusNFeProvider;
use App\Services\Fiscal\NFeDataBuilder;
use App\Services\Fiscal\NFSeDataBuilder;
use App\Services\Fiscal\NuvemFiscalProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FiscalController extends Controller
{
    private FiscalProvider $provider;

    public function __construct()
    {
        $providerName = config('services.fiscal.provider', 'focusnfe');

        $this->provider = match ($providerName) {
            'focusnfe' => new FocusNFeProvider(),
            'nuvemfiscal' => new NuvemFiscalProvider(),
            default => new FocusNFeProvider(),
        };
    }

    /**
     * List fiscal notes for the current tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $query = FiscalNote::forTenant($tenantId)
            ->with(['customer:id,name', 'workOrder:id,number', 'creator:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('type')) {
            $query->ofType($request->input('type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->input('customer_id'));
        }

        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->input('to') . ' 23:59:59');
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('access_key', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        $perPage = min($request->input('per_page', 20), 100);
        $notes = $query->paginate($perPage);

        return response()->json($notes);
    }

    /**
     * Show a single fiscal note with events.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $note = FiscalNote::forTenant($tenantId)
            ->with(['customer', 'workOrder', 'quote', 'creator', 'events'])
            ->findOrFail($id);

        return response()->json(['data' => $note]);
    }

    /**
     * Issue an NF-e.
     */
    public function emitirNFe(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $request->validate([
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->where('tenant_id', $tenantId)],
            'work_order_id' => ['nullable', 'integer', Rule::exists('work_orders', 'id')->where('tenant_id', $tenantId)],
            'quote_id' => ['nullable', 'integer', Rule::exists('quotes', 'id')->where('tenant_id', $tenantId)],
            'nature_of_operation' => 'nullable|string|max:60',
            'cfop' => 'nullable|string|max:4',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:120',
            'items.*.quantity' => 'required|numeric|min:0.0001',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.ncm' => 'nullable|string|max:10',
            'items.*.cfop' => 'nullable|string|max:4',
            'items.*.unit' => 'nullable|string|max:6',
            'items.*.code' => 'nullable|string|max:60',
            'items.*.cest' => 'nullable|string|max:10',
            'items.*.discount' => 'nullable|numeric|min:0',
            // ICMS
            'items.*.csosn' => 'nullable|string|max:3',
            'items.*.icms_cst' => 'nullable|string|max:3',
            'items.*.icms_origin' => 'nullable|string|max:1',
            'items.*.icms_rate' => 'nullable|numeric|min:0|max:100',
            'items.*.icms_credit_rate' => 'nullable|numeric|min:0|max:100',
            // PIS/COFINS
            'items.*.pis_cst' => 'nullable|string|max:2',
            'items.*.pis_rate' => 'nullable|numeric|min:0',
            'items.*.cofins_cst' => 'nullable|string|max:2',
            'items.*.cofins_rate' => 'nullable|numeric|min:0',
            // IPI
            'items.*.ipi_cst' => 'nullable|string|max:2',
            'items.*.ipi_rate' => 'nullable|numeric|min:0',
            // Payment/options
            'payment_method' => 'nullable|string|max:2',
            'informacoes_complementares' => 'nullable|string|max:5000',
        ]);

        return $this->emitDocument($request, FiscalNote::TYPE_NFE);
    }

    /**
     * Issue an NFS-e.
     */
    public function emitirNFSe(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $request->validate([
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->where('tenant_id', $tenantId)],
            'work_order_id' => ['nullable', 'integer', Rule::exists('work_orders', 'id')->where('tenant_id', $tenantId)],
            'quote_id' => ['nullable', 'integer', Rule::exists('quotes', 'id')->where('tenant_id', $tenantId)],
            'services' => 'required|array|min:1',
            'services.*.description' => 'required|string|max:2000',
            'services.*.amount' => 'required|numeric|min:0',
            'services.*.quantity' => 'nullable|numeric|min:1',
            'services.*.service_code' => 'nullable|string|max:20',
            'services.*.lc116_code' => 'nullable|string|max:10',
            'services.*.municipal_service_code' => 'nullable|string|max:20',
            'services.*.cnae_code' => 'nullable|string|max:20',
            'services.*.iss_rate' => 'nullable|numeric|min:0|max:100',
            'services.*.iss_retained' => 'nullable|boolean',
            'services.*.deductions' => 'nullable|numeric|min:0',
            'services.*.discount' => 'nullable|numeric|min:0',
            // ISS options
            'iss_rate' => 'nullable|numeric|min:0|max:100',
            'iss_retained' => 'nullable|boolean',
            'exigibilidade_iss' => 'nullable|string|in:1,2,3,4,5,6,7',
            'natureza_tributacao' => 'nullable|string|max:2',
            // Federal tax retentions
            'pis_rate' => 'nullable|numeric|min:0',
            'cofins_rate' => 'nullable|numeric|min:0',
            'inss_rate' => 'nullable|numeric|min:0',
            'ir_rate' => 'nullable|numeric|min:0',
            'csll_rate' => 'nullable|numeric|min:0',
            'informacoes_complementares' => 'nullable|string|max:5000',
        ]);

        return $this->emitDocument($request, FiscalNote::TYPE_NFSE);
    }

    /**
     * Issue NF-e from an existing Work Order.
     */
    public function emitirNFeFromWorkOrder(Request $request, int $workOrderId): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $wo = WorkOrder::where('tenant_id', $tenantId)->findOrFail($workOrderId);

        $items = $wo->items()->get()->map(fn ($item) => [
            'description' => $item->description ?? $item->name ?? 'Serviço',
            'quantity' => $item->quantity ?? 1,
            'unit_price' => $item->unit_price ?? 0,
            'ncm' => $item->ncm ?? null,
            'cfop' => $item->cfop ?? null,
            'unit' => $item->unit ?? 'UN',
        ])->toArray();

        if (empty($items)) {
            return response()->json(['message' => 'Ordem de Serviço sem itens'], 422);
        }

        $request->merge([
            'customer_id' => $wo->customer_id,
            'work_order_id' => $wo->id,
            'items' => $items,
            'nature_of_operation' => 'Prestação de serviço',
        ]);

        return $this->emitDocument($request, FiscalNote::TYPE_NFE);
    }

    /**
     * Issue NFS-e from an existing Work Order.
     */
    public function emitirNFSeFromWorkOrder(Request $request, int $workOrderId): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $wo = WorkOrder::where('tenant_id', $tenantId)->findOrFail($workOrderId);

        $services = $wo->items()->get()->map(fn ($item) => [
            'description' => $item->description ?? $item->name ?? 'Serviço',
            'amount' => round(($item->quantity ?? 1) * ($item->unit_price ?? 0), 2),
            'quantity' => $item->quantity ?? 1,
            'service_code' => $item->service_code ?? null,
            'lc116_code' => $item->lc116_code ?? null,
            'municipal_service_code' => $item->municipal_service_code ?? null,
            'cnae_code' => $item->cnae_code ?? null,
            'iss_rate' => $item->iss_rate ?? null,
            'iss_retained' => $item->iss_retained ?? false,
        ])->toArray();

        if (empty($services)) {
            return response()->json(['message' => 'Ordem de Serviço sem itens'], 422);
        }

        $request->merge([
            'customer_id' => $wo->customer_id,
            'work_order_id' => $wo->id,
            'services' => $services,
        ]);

        return $this->emitDocument($request, FiscalNote::TYPE_NFSE);
    }

    /**
     * Issue NF-e from an existing Quote.
     */
    public function emitirNFeFromQuote(Request $request, int $quoteId): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $quote = Quote::where('tenant_id', $tenantId)->findOrFail($quoteId);

        $items = $quote->items()->get()->map(fn ($item) => [
            'description' => $item->description ?? $item->name ?? 'Item',
            'quantity' => $item->quantity ?? 1,
            'unit_price' => $item->unit_price ?? 0,
            'ncm' => $item->ncm ?? null,
            'unit' => $item->unit ?? 'UN',
        ])->toArray();

        if (empty($items)) {
            return response()->json(['message' => 'Orçamento sem itens'], 422);
        }

        $request->merge([
            'customer_id' => $quote->customer_id,
            'quote_id' => $quote->id,
            'items' => $items,
            'nature_of_operation' => 'Venda de mercadoria',
        ]);

        return $this->emitDocument($request, FiscalNote::TYPE_NFE);
    }

    /**
     * Cancel a fiscal note.
     */
    public function cancelar(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'justificativa' => 'required|string|min:15|max:255',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $note = FiscalNote::forTenant($tenantId)->findOrFail($id);

        if (!$note->canCancel()) {
            return response()->json(['message' => 'Esta nota não pode ser cancelada (status: ' . $note->status . ')'], 409);
        }

        try {
            $referenceOrKey = $note->reference ?? $note->access_key;

            if (!$referenceOrKey) {
                return response()->json(['message' => 'Nota sem referência ou chave de acesso para cancelamento'], 422);
            }

            $result = $note->isNFSe() && $this->provider instanceof FocusNFeProvider
                ? $this->provider->cancelarNFSe($referenceOrKey, $request->input('justificativa'))
                : $this->provider->cancelar($referenceOrKey, $request->input('justificativa'));

            $this->logEvent($note, 'cancellation', $request->user()->id, $result);

            if ($result->success) {
                $note->update([
                    'status' => FiscalNote::STATUS_CANCELLED,
                    'cancelled_at' => now(),
                    'cancel_reason' => $request->input('justificativa'),
                ]);

                return response()->json([
                    'message' => 'Nota cancelada com sucesso',
                    'data' => $note->fresh(),
                ]);
            }

            return response()->json([
                'message' => 'Erro ao cancelar: ' . $result->errorMessage,
            ], 422);

        } catch (\Exception $e) {
            Log::error('Fiscal note cancel failed', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno ao cancelar nota'], 500);
        }
    }

    /**
     * Inutilizar numeração NF-e.
     */
    public function inutilizar(Request $request): JsonResponse
    {
        $request->validate([
            'serie' => 'required|integer',
            'numero_inicial' => 'required|integer|min:1',
            'numero_final' => 'required|integer|min:1|gte:numero_inicial',
            'justificativa' => 'required|string|min:15|max:255',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $tenant = \App\Models\Tenant::findOrFail($tenantId);

        try {
            $result = $this->provider->inutilizar([
                'cnpj' => preg_replace('/\D/', '', $tenant->cnpj ?? ''),
                'serie' => $request->input('serie'),
                'numero_inicial' => $request->input('numero_inicial'),
                'numero_final' => $request->input('numero_final'),
                'justificativa' => $request->input('justificativa'),
            ]);

            if ($result->success) {
                FiscalEvent::create([
                    'fiscal_note_id' => null,
                    'tenant_id' => $tenantId,
                    'event_type' => 'inutilization',
                    'protocol_number' => $result->protocolNumber,
                    'description' => "Inutilização série {$request->input('serie')} números {$request->input('numero_inicial')} a {$request->input('numero_final')}",
                    'response_payload' => $result->rawResponse,
                    'status' => 'authorized',
                    'user_id' => $request->user()->id,
                ]);

                return response()->json([
                    'message' => 'Numeração inutilizada com sucesso',
                    'data' => $result->rawResponse,
                ]);
            }

            return response()->json(['message' => 'Erro: ' . $result->errorMessage], 422);

        } catch (\Exception $e) {
            Log::error('Inutilização failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno ao inutilizar numeração'], 500);
        }
    }

    /**
     * Issue a Carta de Correção (CC-e) for an NF-e.
     */
    public function cartaCorrecao(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'correcao' => 'required|string|min:15|max:1000',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $note = FiscalNote::forTenant($tenantId)->findOrFail($id);

        if (!$note->canCorrect()) {
            return response()->json(['message' => 'Carta de correção só pode ser emitida para NF-e autorizada'], 409);
        }

        try {
            $referenceOrKey = $note->reference ?? $note->access_key;

            if (!$referenceOrKey) {
                return response()->json(['message' => 'Nota sem referência ou chave de acesso'], 422);
            }

            $result = $this->provider->cartaCorrecao($referenceOrKey, $request->input('correcao'));

            $this->logEvent($note, 'correction', $request->user()->id, $result);

            if ($result->success) {
                return response()->json([
                    'message' => 'Carta de correção emitida com sucesso',
                    'data' => $result->rawResponse,
                ]);
            }

            return response()->json(['message' => 'Erro: ' . $result->errorMessage], 422);

        } catch (\Exception $e) {
            Log::error('CC-e failed', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro interno ao emitir carta de correção'], 500);
        }
    }

    /**
     * Download PDF (DANFE).
     */
    public function downloadPdf(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $note = FiscalNote::forTenant($tenantId)->findOrFail($id);

        if ($note->pdf_url) {
            return response()->json(['url' => $note->pdf_url]);
        }

        if ($note->pdf_path && Storage::exists($note->pdf_path)) {
            $pdf = Storage::get($note->pdf_path);
            return response()->json(['pdf_base64' => base64_encode($pdf)]);
        }

        $referenceOrKey = $note->reference ?? $note->access_key;
        if (!$referenceOrKey) {
            return response()->json(['message' => 'Nota sem referência ou chave de acesso'], 422);
        }

        try {
            $pdf = $this->provider->downloadPdf($referenceOrKey);

            $path = $this->storeFiscalFile($note, $pdf, 'pdf');
            $note->update(['pdf_path' => $path]);

            return response()->json(['pdf_base64' => base64_encode($pdf)]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erro ao baixar PDF'], 500);
        }
    }

    /**
     * Download XML.
     */
    public function downloadXml(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $note = FiscalNote::forTenant($tenantId)->findOrFail($id);

        if ($note->xml_path && Storage::exists($note->xml_path)) {
            $xml = Storage::get($note->xml_path);
            return response()->json(['xml' => $xml]);
        }

        if ($note->xml_url) {
            return response()->json(['url' => $note->xml_url]);
        }

        $referenceOrKey = $note->reference ?? $note->access_key;
        if (!$referenceOrKey) {
            return response()->json(['message' => 'Nota sem referência ou chave de acesso'], 422);
        }

        try {
            $xml = $this->provider->downloadXml($referenceOrKey);

            $path = $this->storeFiscalFile($note, $xml, 'xml');
            $note->update(['xml_path' => $path]);

            return response()->json(['xml' => $xml]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erro ao baixar XML'], 500);
        }
    }

    /**
     * List fiscal events for a note.
     */
    public function events(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $note = FiscalNote::forTenant($tenantId)->findOrFail($id);

        $events = $note->events()->with('user:id,name')->get();

        return response()->json(['data' => $events]);
    }

    /**
     * Get fiscal statistics/dashboard data.
     */
    public function stats(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $month = $request->input('month', now()->format('Y-m'));

        $baseQuery = FiscalNote::forTenant($tenantId)
            ->where('created_at', '>=', "{$month}-01")
            ->where('created_at', '<', \Carbon\Carbon::parse("{$month}-01")->addMonth()->format('Y-m-d'));

        return response()->json([
            'data' => [
                'total' => (clone $baseQuery)->count(),
                'authorized' => (clone $baseQuery)->where('status', FiscalNote::STATUS_AUTHORIZED)->count(),
                'pending' => (clone $baseQuery)->whereIn('status', [FiscalNote::STATUS_PENDING, FiscalNote::STATUS_PROCESSING])->count(),
                'rejected' => (clone $baseQuery)->where('status', FiscalNote::STATUS_REJECTED)->count(),
                'cancelled' => (clone $baseQuery)->where('status', FiscalNote::STATUS_CANCELLED)->count(),
                'total_nfe' => (clone $baseQuery)->where('type', FiscalNote::TYPE_NFE)->where('status', FiscalNote::STATUS_AUTHORIZED)->count(),
                'total_nfse' => (clone $baseQuery)->where('type', FiscalNote::TYPE_NFSE)->where('status', FiscalNote::STATUS_AUTHORIZED)->count(),
                'total_amount' => (clone $baseQuery)->where('status', FiscalNote::STATUS_AUTHORIZED)->sum('total_amount'),
            ],
        ]);
    }

    // ─── Private helpers ─────────────────────────────────

    private function emitDocument(Request $request, string $type): JsonResponse
    {
        try {
            DB::beginTransaction();

            $user = $request->user();
            $tenantId = $user->current_tenant_id;
            $tenant = \App\Models\Tenant::findOrFail($tenantId);

            $isNFe = $type === FiscalNote::TYPE_NFE;
            $items = $request->input($isNFe ? 'items' : 'services', []);

            $totalAmount = $isNFe
                ? collect($items)->sum(fn ($item) => bcmul((string) ($item['quantity'] ?? 1), (string) ($item['unit_price'] ?? 0), 2))
                : collect($items)->sum(fn ($s) => (float) ($s['amount'] ?? 0));

            $reference = FiscalNote::generateReference($type, $tenantId);

            // Allocate sequential number atomically
            $numberingService = new FiscalNumberingService();
            $numbering = $isNFe
                ? $numberingService->nextNFeNumber($tenant)
                : $numberingService->nextNFSeRpsNumber($tenant);

            $note = FiscalNote::create([
                'tenant_id' => $tenantId,
                'type' => $type,
                'customer_id' => $request->input('customer_id'),
                'work_order_id' => $request->input('work_order_id'),
                'quote_id' => $request->input('quote_id'),
                'status' => FiscalNote::STATUS_PENDING,
                'provider' => config('services.fiscal.provider', 'focusnfe'),
                'reference' => $reference,
                'number' => $numbering['number'],
                'series' => $numbering['series'],
                'total_amount' => $totalAmount,
                'nature_of_operation' => $request->input('nature_of_operation', $isNFe ? 'Venda de mercadoria' : null),
                'cfop' => $request->input('cfop'),
                'items_data' => $items,
                'environment' => $tenant->fiscal_environment ?? 'homologation',
                'created_by' => $user->id,
            ]);

            // Build payload: use NFeDataBuilder for NF-e, NFSeDataBuilder for NFS-e
            if ($isNFe) {
                $builder = new NFeDataBuilder($tenant, $note, $items, [
                    'cfop' => $request->input('cfop'),
                    'payment_method' => $request->input('payment_method'),
                    'informacoes_complementares' => $request->input('informacoes_complementares'),
                ]);
                $payload = $builder->build();
            } else {
                $builder = new NFSeDataBuilder($tenant, $note, $items, [
                    'iss_rate' => $request->input('iss_rate'),
                    'iss_retained' => $request->input('iss_retained'),
                    'exigibilidade_iss' => $request->input('exigibilidade_iss'),
                    'natureza_tributacao' => $request->input('natureza_tributacao'),
                    'service_code' => $request->input('services.0.service_code'),
                    'municipal_service_code' => $request->input('services.0.municipal_service_code'),
                    'pis_rate' => $request->input('pis_rate'),
                    'cofins_rate' => $request->input('cofins_rate'),
                    'inss_rate' => $request->input('inss_rate'),
                    'ir_rate' => $request->input('ir_rate'),
                    'csll_rate' => $request->input('csll_rate'),
                    'informacoes_complementares' => $request->input('informacoes_complementares'),
                ]);
                $payload = $builder->build();
            }

            $payload['ref'] = $reference;

            $result = $isNFe
                ? $this->provider->emitirNFe($payload)
                : $this->provider->emitirNFSe($payload);

            $this->logEvent($note, 'emission', $user->id, $result);

            if ($result->success) {
                $updateData = [
                    'provider_id' => $result->providerId ?? $result->reference,
                    'access_key' => $result->accessKey,
                    'status' => $result->status === 'processing' ? FiscalNote::STATUS_PROCESSING : FiscalNote::STATUS_AUTHORIZED,
                    'protocol_number' => $result->protocolNumber,
                    'verification_code' => $result->verificationCode,
                    'pdf_url' => $result->pdfUrl,
                    'xml_url' => $result->xmlUrl,
                    'raw_response' => $result->rawResponse,
                ];

                // If the API returned a number/series, use those (SEFAZ-assigned)
                if ($result->number) {
                    $updateData['number'] = $result->number;
                }
                if ($result->series) {
                    $updateData['series'] = $result->series;
                }

                if ($result->status !== 'processing') {
                    $updateData['issued_at'] = now();
                }

                $note->update($updateData);
            } else {
                $note->update([
                    'status' => FiscalNote::STATUS_REJECTED,
                    'error_message' => $result->errorMessage,
                    'raw_response' => $result->rawResponse,
                ]);
            }

            DB::commit();

            $statusCode = $result->success ? ($result->status === 'processing' ? 202 : 201) : 422;

            return response()->json([
                'message' => $result->success
                    ? ($result->status === 'processing' ? 'Nota em processamento na SEFAZ' : ($isNFe ? 'NF-e emitida com sucesso' : 'NFS-e emitida com sucesso'))
                    : 'Erro na emissão',
                'data' => $note->fresh(),
                'success' => $result->success,
            ], $statusCode);

        } catch (ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("{$type} emission failed", ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);

            // Contingency fallback: if connection error, save offline
            if ($this->isConnectionError($e) && isset($note) && isset($payload)) {
                try {
                    DB::beginTransaction();
                    $note->update(['status' => FiscalNote::STATUS_PENDING, 'contingency_mode' => true]);
                    $contingency = new ContingencyService($this->provider);
                    $contingency->saveOffline($note, $payload);
                    DB::commit();

                    return response()->json([
                        'message' => 'SEFAZ indisponível. Nota salva em contingência para envio posterior.',
                        'data' => $note->fresh(),
                        'success' => true,
                        'contingency' => true,
                    ], 202);
                } catch (\Exception $contingencyEx) {
                    DB::rollBack();
                    Log::error('Contingency save also failed', ['error' => $contingencyEx->getMessage()]);
                }
            }

            return response()->json(['message' => 'Erro interno ao emitir nota fiscal'], 500);
        }
    }

    /**
     * Send fiscal note by email (PDF + XML).
     */
    public function sendEmail(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $note = FiscalNote::forTenant($tenantId)->findOrFail($id);

        $request->validate([
            'email' => 'nullable|email|max:255',
            'message' => 'nullable|string|max:5000',
        ]);

        $emailService = new FiscalEmailService();
        $result = $emailService->send(
            $note,
            $request->input('email'),
            $request->input('message')
        );

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    /**
     * Retransmit all contingency (offline) notes.
     */
    public function retransmitContingency(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $tenant = \App\Models\Tenant::findOrFail($tenantId);

        $contingency = new ContingencyService($this->provider);
        $result = $contingency->retransmitPending($tenant);

        return response()->json($result);
    }

    /**
     * Get contingency status (pending count).
     */
    public function contingencyStatus(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $contingency = new ContingencyService($this->provider);

        return response()->json([
            'pending_count' => $contingency->pendingCount($tenantId),
            'sefaz_available' => $contingency->isSefazAvailable(),
        ]);
    }

    /**
     * Retransmit a single contingency note.
     */
    public function retransmitSingleNote(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $note = FiscalNote::forTenant($tenantId)
            ->where('contingency_mode', true)
            ->findOrFail($id);

        $contingency = new ContingencyService($this->provider);
        $result = $contingency->retransmitNote($note);

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    /**
     * Check if an exception is a connection error (SEFAZ down).
     */
    private function isConnectionError(\Exception $e): bool
    {
        $message = strtolower($e->getMessage());
        $connectionPatterns = ['connection refused', 'timeout', 'could not resolve', 'ssl', 'curl error', '503', '502'];

        foreach ($connectionPatterns as $pattern) {
            if (str_contains($message, $pattern)) {
                return true;
            }
        }

        return false;
    }

    private function logEvent(FiscalNote $note, string $eventType, int $userId, $result): void
    {
        FiscalEvent::create([
            'fiscal_note_id' => $note->id,
            'tenant_id' => $note->tenant_id,
            'event_type' => $eventType,
            'protocol_number' => $result->protocolNumber ?? null,
            'description' => $this->eventDescription($eventType, $note),
            'response_payload' => $result->rawResponse,
            'status' => $result->success ? 'authorized' : 'rejected',
            'error_message' => $result->errorMessage,
            'user_id' => $userId,
        ]);
    }

    private function eventDescription(string $type, FiscalNote $note): string
    {
        return match ($type) {
            'emission' => "Emissão {$note->type} #{$note->id}",
            'cancellation' => "Cancelamento {$note->type} #{$note->number}",
            'correction' => "Carta de Correção {$note->type} #{$note->number}",
            'inutilization' => "Inutilização de numeração",
            default => "Evento {$type}",
        };
    }

    private function storeFiscalFile(FiscalNote $note, string $content, string $extension): string
    {
        $year = now()->format('Y');
        $month = now()->format('m');
        $dir = "fiscal/{$note->tenant_id}/{$extension}/{$year}/{$month}";
        $filename = "{$note->type}_{$note->number}_{$note->id}.{$extension}";

        Storage::put("{$dir}/{$filename}", $content);

        return "{$dir}/{$filename}";
    }
}
