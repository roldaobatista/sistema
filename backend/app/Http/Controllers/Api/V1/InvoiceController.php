<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    use ResolvesCurrentTenant;

    private const NON_CANCELLED_STATUSES = [
        Invoice::STATUS_DRAFT,
        Invoice::STATUS_ISSUED,
        Invoice::STATUS_SENT,
    ];

    private const ALLOWED_TRANSITIONS = [
        Invoice::STATUS_DRAFT => [Invoice::STATUS_ISSUED, Invoice::STATUS_CANCELLED],
        Invoice::STATUS_ISSUED => [Invoice::STATUS_SENT, Invoice::STATUS_CANCELLED],
        Invoice::STATUS_SENT => [Invoice::STATUS_CANCELLED],
        Invoice::STATUS_CANCELLED => [],
    ];

    private function canTransition(string $from, string $to): bool
    {
        if ($from === $to) {
            return true;
        }

        return in_array($to, self::ALLOWED_TRANSITIONS[$from] ?? [], true);
    }

    private function ensureTenantOwnership(Invoice $invoice, int $tenantId): ?JsonResponse
    {
        if ((int) $invoice->tenant_id !== $tenantId) {
            return response()->json(['message' => 'Fatura nao encontrada'], 404);
        }

        return null;
    }

    private function syncWorkOrderAfterInvoiceChange(?int $workOrderId, int $tenantId, int $userId): void
    {
        if (!$workOrderId) {
            return;
        }

        $workOrder = WorkOrder::query()
            ->where('tenant_id', $tenantId)
            ->find($workOrderId);

        if (!$workOrder || $workOrder->status !== WorkOrder::STATUS_INVOICED) {
            return;
        }

        $hasActiveInvoice = Invoice::query()
            ->where('tenant_id', $tenantId)
            ->where('work_order_id', $workOrder->id)
            ->whereIn('status', self::NON_CANCELLED_STATUSES)
            ->exists();

        if ($hasActiveInvoice) {
            return;
        }

        $workOrder->update(['status' => WorkOrder::STATUS_DELIVERED]);
        $workOrder->statusHistory()->create([
            'user_id' => $userId,
            'from_status' => WorkOrder::STATUS_INVOICED,
            'to_status' => WorkOrder::STATUS_DELIVERED,
            'notes' => 'Status ajustado apos cancelamento/exclusao da fatura',
        ]);
    }

    private function invoiceMetadataPayload(int $tenantId): array
    {
        $customers = Customer::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('name')
            ->limit(200)
            ->get(['id', 'name']);

        $workOrders = WorkOrder::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', [WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_INVOICED])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get(['id', 'customer_id', 'number', 'os_number', 'status', 'total'])
            ->filter(function (WorkOrder $workOrder) use ($tenantId) {
                $hasActiveInvoice = Invoice::query()
                    ->where('tenant_id', $tenantId)
                    ->where('work_order_id', $workOrder->id)
                    ->whereIn('status', self::NON_CANCELLED_STATUSES)
                    ->exists();

                return !$hasActiveInvoice;
            })
            ->values()
            ->map(function (WorkOrder $workOrder) {
                return [
                    'id' => $workOrder->id,
                    'customer_id' => $workOrder->customer_id,
                    'number' => $workOrder->number,
                    'os_number' => $workOrder->os_number,
                    'business_number' => $workOrder->business_number,
                    'status' => $workOrder->status,
                    'total' => (float) $workOrder->total,
                ];
            });

        return [
            'customers' => $customers,
            'work_orders' => $workOrders,
            'statuses' => Invoice::STATUSES,
        ];
    }

    public function metadata(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();
            return response()->json($this->invoiceMetadataPayload($tenantId));
        } catch (\Throwable $e) {
            Log::error('Invoice metadata failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar metadados de faturamento'], 500);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(array_keys(Invoice::STATUSES))],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Parametros invalidos para listar faturas.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $tenantId = $this->resolvedTenantId();
            $query = Invoice::query()
                ->where('tenant_id', $tenantId)
                ->with(['customer:id,name', 'workOrder:id,number,os_number', 'creator:id,name']);

            if ($search = trim((string) $request->get('search', ''))) {
                $query->where(function ($q) use ($search) {
                    $q->where('invoice_number', 'like', "%{$search}%")
                        ->orWhere('nf_number', 'like', "%{$search}%")
                        ->orWhereHas('customer', fn ($customerQuery) => $customerQuery->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('workOrder', function ($workOrderQuery) use ($search) {
                            $workOrderQuery->where('number', 'like', "%{$search}%")
                                ->orWhere('os_number', 'like', "%{$search}%");
                        });
                });
            }

            if ($status = $request->get('status')) {
                $query->where('status', $status);
            }

            return response()->json(
                $query->orderByDesc('created_at')
                    ->paginate((int) ($request->get('per_page', 20)))
            );
        } catch (\Throwable $e) {
            Log::error('Invoice index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar faturas'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();
        $userId = (int) $request->user()->id;

        $validated = $request->validate([
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($query) => $query->where('tenant_id', $tenantId))],
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($query) => $query->where('tenant_id', $tenantId))],
            'nf_number' => ['nullable', 'string', 'max:50'],
            'due_date' => ['nullable', 'date'],
            'observations' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $observations = $validated['observations'] ?? $validated['notes'] ?? null;

        if (!empty($validated['work_order_id'])) {
            $workOrder = WorkOrder::query()
                ->where('tenant_id', $tenantId)
                ->find($validated['work_order_id']);

            if (!$workOrder) {
                return response()->json(['message' => 'OS nao encontrada para faturamento'], 422);
            }
            if ((int) $workOrder->customer_id !== (int) $validated['customer_id']) {
                return response()->json(['message' => 'Cliente da fatura deve ser o mesmo da OS selecionada'], 422);
            }

            $hasActiveInvoice = Invoice::query()
                ->where('tenant_id', $tenantId)
                ->where('work_order_id', $workOrder->id)
                ->whereIn('status', self::NON_CANCELLED_STATUSES)
                ->exists();
            if ($hasActiveInvoice) {
                return response()->json(['message' => 'Ja existe fatura ativa para esta OS'], 422);
            }
        }

        try {
            $invoice = DB::transaction(function () use ($validated, $tenantId, $userId, $observations) {
                $invoice = Invoice::create([
                    'tenant_id' => $tenantId,
                    'work_order_id' => $validated['work_order_id'] ?? null,
                    'customer_id' => $validated['customer_id'],
                    'created_by' => $userId,
                    'invoice_number' => Invoice::nextNumber($tenantId),
                    'nf_number' => $validated['nf_number'] ?? null,
                    'status' => Invoice::STATUS_DRAFT,
                    'total' => 0,
                    'due_date' => $validated['due_date'] ?? null,
                    'observations' => $observations,
                ]);

                if (!$invoice->work_order_id) {
                    return $invoice;
                }

                $workOrder = WorkOrder::with('items')->find($invoice->work_order_id);
                if (!$workOrder) {
                    return $invoice;
                }

                $invoice->update([
                    'total' => $workOrder->total,
                    'items' => $workOrder->items->map(fn ($item) => [
                        'description' => $item->description,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'total' => $item->total,
                        'type' => $item->type,
                    ])->toArray(),
                ]);

                if ($workOrder->status === WorkOrder::STATUS_DELIVERED) {
                    $workOrder->update(['status' => WorkOrder::STATUS_INVOICED]);
                    $workOrder->statusHistory()->create([
                        'user_id' => $userId,
                        'from_status' => WorkOrder::STATUS_DELIVERED,
                        'to_status' => WorkOrder::STATUS_INVOICED,
                        'notes' => "Faturada automaticamente - NF {$invoice->invoice_number}",
                    ]);
                }

                return $invoice;
            });

            return response()->json(
                $invoice->load(['customer:id,name', 'workOrder:id,number,os_number', 'creator:id,name']),
                201
            );
        } catch (\Throwable $e) {
            Log::error('Invoice store failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao criar fatura'], 500);
        }
    }

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();
        $ownershipError = $this->ensureTenantOwnership($invoice, $tenantId);
        if ($ownershipError) {
            return $ownershipError;
        }

        return response()->json($invoice->load(['customer:id,name', 'workOrder:id,number,os_number', 'creator:id,name']));
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();
        $userId = (int) $request->user()->id;
        $ownershipError = $this->ensureTenantOwnership($invoice, $tenantId);
        if ($ownershipError) {
            return $ownershipError;
        }

        if ($invoice->status === Invoice::STATUS_CANCELLED) {
            return response()->json(['message' => 'Fatura cancelada nao pode ser editada'], 422);
        }

        $validated = $request->validate([
            'nf_number' => ['nullable', 'string', 'max:50'],
            'status' => ['sometimes', Rule::in(array_keys(Invoice::STATUSES))],
            'due_date' => ['nullable', 'date'],
            'observations' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'total' => ['sometimes', 'numeric', 'min:0'],
        ]);

        $nextStatus = $validated['status'] ?? $invoice->status;
        if (!$this->canTransition($invoice->status, $nextStatus)) {
            return response()->json([
                'message' => "Transicao de status invalida: {$invoice->status} -> {$nextStatus}",
            ], 422);
        }

        if (($validated['status'] ?? null) && in_array($validated['status'], [Invoice::STATUS_ISSUED, Invoice::STATUS_SENT], true) && !$invoice->issued_at) {
            $validated['issued_at'] = now();
        }

        if (array_key_exists('notes', $validated) || array_key_exists('observations', $validated)) {
            $validated['observations'] = $validated['observations'] ?? $validated['notes'] ?? null;
        }
        unset($validated['notes']);

        try {
            DB::transaction(function () use ($invoice, $validated, $tenantId, $userId) {
                $invoice->update($validated);

                if (($validated['status'] ?? null) === Invoice::STATUS_CANCELLED) {
                    $this->syncWorkOrderAfterInvoiceChange($invoice->work_order_id, $tenantId, $userId);
                }
            });

            return response()->json($invoice->fresh()->load(['customer:id,name', 'workOrder:id,number,os_number', 'creator:id,name']));
        } catch (\Throwable $e) {
            Log::error('Invoice update failed', ['id' => $invoice->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar fatura'], 500);
        }
    }

    public function destroy(Request $request, Invoice $invoice): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();
        $userId = (int) $request->user()->id;
        $ownershipError = $this->ensureTenantOwnership($invoice, $tenantId);
        if ($ownershipError) {
            return $ownershipError;
        }

        if (in_array($invoice->status, [Invoice::STATUS_ISSUED, Invoice::STATUS_SENT], true)) {
            return response()->json(['message' => 'Fatura emitida/enviada nao pode ser excluida. Cancele-a primeiro.'], 422);
        }

        try {
            DB::transaction(function () use ($invoice, $tenantId, $userId) {
                $workOrderId = $invoice->work_order_id;
                $invoice->delete();
                $this->syncWorkOrderAfterInvoiceChange($workOrderId, $tenantId, $userId);
            });

            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error('Invoice destroy failed', ['id' => $invoice->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir fatura'], 500);
        }
    }
}
