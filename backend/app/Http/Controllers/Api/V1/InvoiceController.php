<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['customer:id,name', 'workOrder:id,number', 'creator:id,name']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('nf_number', 'like', "%{$search}%");
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
        $validated = $request->validate([
            'work_order_id' => 'nullable|exists:work_orders,id',
            'customer_id' => 'required|exists:customers,id',
            'nf_number' => 'nullable|string|max:50',
            'due_date' => 'nullable|date',
            'observations' => 'nullable|string',
        ]);

        $tenantId = auth()->user()->tenant_id;

        $invoice = Invoice::create([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => auth()->id(),
            'invoice_number' => Invoice::nextNumber($tenantId),
            'status' => 'draft',
            'total' => 0,
        ]);

        // Se vinculada a OS, copiar itens e atualizar status
        if ($invoice->work_order_id) {
            $wo = WorkOrder::with('items')->find($invoice->work_order_id);
            if ($wo) {
                $invoice->update([
                    'total' => $wo->total,
                    'items' => $wo->items->map(fn($i) => [
                        'description' => $i->description,
                        'quantity' => $i->quantity,
                        'unit_price' => $i->unit_price,
                        'total' => $i->total,
                        'type' => $i->type,
                    ])->toArray(),
                ]);

                // Gap #8 — Transicionar OS para invoiced automaticamente
                if ($wo->status === WorkOrder::STATUS_DELIVERED) {
                    $wo->update(['status' => WorkOrder::STATUS_INVOICED]);
                    $wo->statusHistory()->create([
                        'user_id' => auth()->id(),
                        'from_status' => WorkOrder::STATUS_DELIVERED,
                        'to_status' => WorkOrder::STATUS_INVOICED,
                        'notes' => "Faturada automaticamente — NF {$invoice->invoice_number}",
                    ]);
                }
            }
        }

        return response()->json($invoice->load(['customer', 'workOrder', 'creator']), 201);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return response()->json($invoice->load(['customer', 'workOrder', 'creator']));
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        if ($invoice->status === 'cancelled') {
            return response()->json(['message' => 'Fatura cancelada não pode ser editada'], 422);
        }

        $validated = $request->validate([
            'nf_number' => 'nullable|string|max:50',
            'status' => 'sometimes|in:draft,issued,sent,cancelled',
            'due_date' => 'nullable|date',
            'observations' => 'nullable|string',
            'total' => 'sometimes|numeric|min:0',
        ]);

        // If issuing, set issued_at
        if (($validated['status'] ?? null) === 'issued' && !$invoice->issued_at) {
            $validated['issued_at'] = now();
        }

        $invoice->update($validated);

        return response()->json($invoice->load(['customer', 'workOrder', 'creator']));
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        $invoice->delete();
        return response()->json(null, 204);
    }
}
