<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    private function tenantId(Request $request): int
    {
        return (int) ($request->user()->current_tenant_id ?? $request->user()->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['customer:id,name', 'workOrder:id,number,os_number', 'creator:id,name']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('nf_number', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('workOrder', function ($wo) use ($search) {
                        $wo->where('number', 'like', "%{$search}%")
                            ->orWhere('os_number', 'like', "%{$search}%");
                    });
            });
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        return response()->json(
            $query->orderByDesc('created_at')
                ->paginate($request->get('per_page', 20))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'nf_number' => 'nullable|string|max:50',
            'due_date' => 'nullable|date',
            'observations' => 'nullable|string',
        ]);

        $invoice = Invoice::create([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => auth()->id(),
            'invoice_number' => Invoice::nextNumber($tenantId),
            'status' => Invoice::STATUS_DRAFT,
            'total' => 0,
        ]);

        // Se vinculada a OS, copia itens e atualiza status.
        if ($invoice->work_order_id) {
            $wo = WorkOrder::with('items')->find($invoice->work_order_id);
            if ($wo) {
                $invoice->update([
                    'total' => $wo->total,
                    'items' => $wo->items->map(fn ($i) => [
                        'description' => $i->description,
                        'quantity' => $i->quantity,
                        'unit_price' => $i->unit_price,
                        'total' => $i->total,
                        'type' => $i->type,
                    ])->toArray(),
                ]);

                if ($wo->status === WorkOrder::STATUS_DELIVERED) {
                    $wo->update(['status' => WorkOrder::STATUS_INVOICED]);
                    $wo->statusHistory()->create([
                        'user_id' => auth()->id(),
                        'from_status' => WorkOrder::STATUS_DELIVERED,
                        'to_status' => WorkOrder::STATUS_INVOICED,
                        'notes' => "Faturada automaticamente - NF {$invoice->invoice_number}",
                    ]);
                }
            }
        }

        return response()->json($invoice->load(['customer:id,name', 'workOrder:id,number,os_number', 'creator:id,name']), 201);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return response()->json($invoice->load(['customer:id,name', 'workOrder:id,number,os_number', 'creator:id,name']));
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        if ($invoice->status === Invoice::STATUS_CANCELLED) {
            return response()->json(['message' => 'Fatura cancelada nao pode ser editada'], 422);
        }

        $validated = $request->validate([
            'nf_number' => 'nullable|string|max:50',
            'status' => ['sometimes', Rule::in(array_keys(Invoice::STATUSES))],
            'due_date' => 'nullable|date',
            'observations' => 'nullable|string',
            'total' => 'sometimes|numeric|min:0',
        ]);

        // If issuing, set issued_at.
        if (($validated['status'] ?? null) === Invoice::STATUS_ISSUED && !$invoice->issued_at) {
            $validated['issued_at'] = now();
        }

        $invoice->update($validated);

        return response()->json($invoice->load(['customer:id,name', 'workOrder:id,number,os_number', 'creator:id,name']));
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        $invoice->delete();

        return response()->json(null, 204);
    }
}
