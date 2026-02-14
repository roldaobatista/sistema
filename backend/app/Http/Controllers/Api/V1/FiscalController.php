<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FiscalNote;
use App\Services\Fiscal\FiscalProvider;
use App\Services\Fiscal\NuvemFiscalProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class FiscalController extends Controller
{
    private FiscalProvider $provider;

    public function __construct()
    {
        $providerName = config('services.fiscal.provider', 'nuvemfiscal');

        $this->provider = match ($providerName) {
            'nuvemfiscal' => new NuvemFiscalProvider(),
            default => new NuvemFiscalProvider(),
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
     * Show a single fiscal note.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $note = FiscalNote::forTenant($tenantId)
            ->with(['customer', 'workOrder', 'quote', 'creator'])
            ->findOrFail($id);

        return response()->json(['data' => $note]);
    }

    /**
     * Issue an NF-e.
     */
    public function emitirNFe(Request $request): JsonResponse
    {
        $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'work_order_id' => 'nullable|integer|exists:work_orders,id',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.ncm' => 'nullable|string|max:10',
        ]);

        try {
            DB::beginTransaction();

            $user = $request->user();
            $tenantId = $user->current_tenant_id;

            $totalAmount = collect($request->input('items'))
                ->sum(fn ($item) => bcmul((string) $item['quantity'], (string) $item['unit_price'], 2));

            $note = FiscalNote::create([
                'tenant_id' => $tenantId,
                'type' => FiscalNote::TYPE_NFE,
                'customer_id' => $request->input('customer_id'),
                'work_order_id' => $request->input('work_order_id'),
                'status' => FiscalNote::STATUS_PENDING,
                'provider' => config('services.fiscal.provider', 'nuvemfiscal'),
                'total_amount' => $totalAmount,
                'created_by' => $user->id,
            ]);

            $result = $this->provider->emitirNFe([
                'natureza_operacao' => 'Prestação de serviço',
                'tipo_documento' => 1,
                'items' => $request->input('items'),
                'customer_id' => $request->input('customer_id'),
            ]);

            if ($result->success) {
                $note->update([
                    'provider_id' => $result->providerId,
                    'access_key' => $result->accessKey,
                    'number' => $result->number,
                    'series' => $result->series,
                    'status' => FiscalNote::STATUS_AUTHORIZED,
                    'pdf_url' => $result->pdfUrl,
                    'xml_url' => $result->xmlUrl,
                    'issued_at' => now(),
                    'raw_response' => $result->rawResponse,
                ]);
            } else {
                $note->update([
                    'status' => FiscalNote::STATUS_REJECTED,
                    'error_message' => $result->errorMessage,
                    'raw_response' => $result->rawResponse,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => $result->success ? 'NF-e emitida com sucesso' : 'Erro na emissão',
                'data' => $note->fresh(),
                'success' => $result->success,
            ], $result->success ? 201 : 422);

        } catch (ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('NF-e emission failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao emitir NF-e'], 500);
        }
    }

    /**
     * Issue an NFS-e.
     */
    public function emitirNFSe(Request $request): JsonResponse
    {
        $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'work_order_id' => 'nullable|integer|exists:work_orders,id',
            'services' => 'required|array|min:1',
            'services.*.description' => 'required|string|max:255',
            'services.*.amount' => 'required|numeric|min:0',
            'services.*.service_code' => 'nullable|string|max:20',
        ]);

        try {
            DB::beginTransaction();

            $user = $request->user();
            $tenantId = $user->current_tenant_id;

            $totalAmount = collect($request->input('services'))
                ->sum(fn ($s) => (float) $s['amount']);

            $note = FiscalNote::create([
                'tenant_id' => $tenantId,
                'type' => FiscalNote::TYPE_NFSE,
                'customer_id' => $request->input('customer_id'),
                'work_order_id' => $request->input('work_order_id'),
                'status' => FiscalNote::STATUS_PENDING,
                'provider' => config('services.fiscal.provider', 'nuvemfiscal'),
                'total_amount' => $totalAmount,
                'created_by' => $user->id,
            ]);

            $result = $this->provider->emitirNFSe([
                'services' => $request->input('services'),
                'customer_id' => $request->input('customer_id'),
            ]);

            if ($result->success) {
                $note->update([
                    'provider_id' => $result->providerId,
                    'access_key' => $result->accessKey,
                    'number' => $result->number,
                    'status' => FiscalNote::STATUS_AUTHORIZED,
                    'pdf_url' => $result->pdfUrl,
                    'xml_url' => $result->xmlUrl,
                    'issued_at' => now(),
                    'raw_response' => $result->rawResponse,
                ]);
            } else {
                $note->update([
                    'status' => FiscalNote::STATUS_REJECTED,
                    'error_message' => $result->errorMessage,
                    'raw_response' => $result->rawResponse,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => $result->success ? 'NFS-e emitida com sucesso' : 'Erro na emissão',
                'data' => $note->fresh(),
                'success' => $result->success,
            ], $result->success ? 201 : 422);

        } catch (ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('NFS-e emission failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro interno ao emitir NFS-e'], 500);
        }
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
            $result = $this->provider->cancelar($note->access_key, $request->input('justificativa'));

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
     * Download PDF (DANFE).
     */
    public function downloadPdf(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;
        $note = FiscalNote::forTenant($tenantId)->findOrFail($id);

        if ($note->pdf_url) {
            return response()->json(['url' => $note->pdf_url]);
        }

        if (!$note->access_key) {
            return response()->json(['message' => 'Nota sem chave de acesso'], 422);
        }

        try {
            $pdf = $this->provider->downloadPdf($note->access_key);
            return response()->json(['pdf_base64' => $pdf]);
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

        if ($note->xml_url) {
            return response()->json(['url' => $note->xml_url]);
        }

        if (!$note->access_key) {
            return response()->json(['message' => 'Nota sem chave de acesso'], 422);
        }

        try {
            $xml = $this->provider->downloadXml($note->access_key);
            return response()->json(['xml' => $xml]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Erro ao baixar XML'], 500);
        }
    }
}
