<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Quote;
use App\Models\QuoteEquipment;
use App\Models\QuoteItem;
use App\Models\QuotePhoto;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Quote::with(['customer:id,name', 'seller:id,name'])
            ->withCount('equipments');

        if ($s = $request->get('search')) {
            $query->where(function ($q) use ($s) {
                $q->where('quote_number', 'like', "%$s%")
                    ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%$s%"));
            });
        }
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }
        if ($sellerId = $request->get('seller_id')) {
            $query->where('seller_id', $sellerId);
        }

        $quotes = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        return response()->json($quotes);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'seller_id' => 'required|exists:users,id',
            'valid_until' => 'nullable|date|after:today',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'observations' => 'nullable|string',
            'internal_notes' => 'nullable|string',
            'equipments' => 'required|array|min:1',
            'equipments.*.equipment_id' => 'required|exists:equipments,id',
            'equipments.*.description' => 'nullable|string',
            'equipments.*.items' => 'required|array|min:1',
            'equipments.*.items.*.type' => 'required|in:product,service',
            'equipments.*.items.*.product_id' => 'nullable|exists:products,id',
            'equipments.*.items.*.service_id' => 'nullable|exists:services,id',
            'equipments.*.items.*.custom_description' => 'nullable|string',
            'equipments.*.items.*.quantity' => 'required|numeric|min:0.01',
            'equipments.*.items.*.original_price' => 'required|numeric|min:0',
            'equipments.*.items.*.unit_price' => 'required|numeric|min:0',
            'equipments.*.items.*.discount_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        $quote = Quote::create([
            'tenant_id' => auth()->user()->tenant_id,
            'quote_number' => Quote::nextNumber(auth()->user()->tenant_id),
            'customer_id' => $validated['customer_id'],
            'seller_id' => $validated['seller_id'],
            'valid_until' => $validated['valid_until'] ?? null,
            'discount_percentage' => $validated['discount_percentage'] ?? 0,
            'observations' => $validated['observations'] ?? null,
            'internal_notes' => $validated['internal_notes'] ?? null,
        ]);

        foreach ($validated['equipments'] as $i => $eqData) {
            $eq = $quote->equipments()->create([
                'equipment_id' => $eqData['equipment_id'],
                'description' => $eqData['description'] ?? null,
                'sort_order' => $i,
            ]);

            foreach ($eqData['items'] as $j => $itemData) {
                $eq->items()->create([
                    ...$itemData,
                    'sort_order' => $j,
                ]);
            }
        }

        $quote->recalculateTotal();
        AuditLog::log('created', "Orçamento {$quote->quote_number} criado", $quote);

        return response()->json(
            $quote->load(['customer', 'seller', 'equipments.equipment', 'equipments.items']),
            201
        );
    }

    public function show(Quote $quote): JsonResponse
    {
        return response()->json(
            $quote->load([
                'customer.contacts',
                'seller:id,name',
                'equipments.equipment',
                'equipments.items.product',
                'equipments.items.service',
                'equipments.photos',
            ])
        );
    }

    public function update(Request $request, Quote $quote): JsonResponse
    {
        if (!in_array($quote->status, ['draft', 'rejected'])) {
            return response()->json(['message' => 'Só é possível editar orçamentos em rascunho ou rejeitados'], 422);
        }

        $validated = $request->validate([
            'customer_id' => 'sometimes|exists:customers,id',
            'seller_id' => 'sometimes|exists:users,id',
            'valid_until' => 'nullable|date',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'observations' => 'nullable|string',
            'internal_notes' => 'nullable|string',
        ]);

        $quote->update($validated);
        $quote->increment('revision');
        $quote->recalculateTotal();

        return response()->json($quote->fresh(['customer', 'seller', 'equipments.items']));
    }

    public function destroy(Quote $quote): JsonResponse
    {
        if ($quote->status !== 'draft') {
            return response()->json(['message' => 'Só é possível excluir orçamentos em rascunho'], 422);
        }
        $quote->delete();
        return response()->json(null, 204);
    }

    // ── Ações de Negócio ──

    public function send(Quote $quote): JsonResponse
    {
        if ($quote->status !== 'draft') {
            return response()->json(['message' => 'Orçamento precisa estar em rascunho para enviar'], 422);
        }
        $quote->update(['status' => 'sent', 'sent_at' => now()]);
        AuditLog::log('status_changed', "Orçamento {$quote->quote_number} enviado ao cliente", $quote);
        return response()->json($quote);
    }

    public function approve(Quote $quote): JsonResponse
    {
        if ($quote->status !== 'sent') {
            return response()->json(['message' => 'Orçamento precisa estar enviado para aprovar'], 422);
        }
        $quote->update(['status' => 'approved', 'approved_at' => now()]);
        AuditLog::log('status_changed', "Orçamento {$quote->quote_number} aprovado", $quote);
        return response()->json($quote);
    }

    public function reject(Request $request, Quote $quote): JsonResponse
    {
        if ($quote->status !== 'sent') {
            return response()->json(['message' => 'Orçamento precisa estar enviado para rejeitar'], 422);
        }
        $quote->update([
            'status' => 'rejected',
            'rejected_at' => now(),
            'rejection_reason' => $request->get('reason'),
        ]);
        AuditLog::log('status_changed', "Orçamento {$quote->quote_number} rejeitado", $quote);
        return response()->json($quote);
    }

    public function duplicate(Quote $quote): JsonResponse
    {
        $newQuote = $quote->replicate(['quote_number', 'status', 'sent_at', 'approved_at', 'rejected_at']);
        $newQuote->quote_number = Quote::nextNumber($quote->tenant_id);
        $newQuote->status = 'draft';
        $newQuote->save();

        foreach ($quote->equipments as $eq) {
            $newEq = $newQuote->equipments()->create($eq->only(['equipment_id', 'description', 'sort_order']));
            foreach ($eq->items as $item) {
                $newEq->items()->create($item->only([
                    'type', 'product_id', 'service_id', 'custom_description',
                    'quantity', 'original_price', 'unit_price', 'discount_percentage', 'sort_order',
                ]));
            }
        }

        $newQuote->recalculateTotal();
        AuditLog::log('created', "Orçamento {$newQuote->quote_number} duplicado de {$quote->quote_number}", $newQuote);

        return response()->json($newQuote->load(['customer', 'seller', 'equipments.items']), 201);
    }

    public function convertToWorkOrder(Quote $quote): JsonResponse
    {
        if ($quote->status !== 'approved') {
            return response()->json(['message' => 'Orçamento precisa estar aprovado para converter'], 422);
        }

        $wo = WorkOrder::create([
            'tenant_id' => $quote->tenant_id,
            'customer_id' => $quote->customer_id,
            'quote_id' => $quote->id,
            'origin_type' => 'quote',
            'seller_id' => $quote->seller_id,
            'status' => 'open',
            'priority' => 'normal',
            'description' => $quote->observations ?? "Gerada a partir do orçamento {$quote->quote_number}",
            'total' => $quote->total,
        ]);

        // Copy items
    foreach ($quote->equipments as $eq) {
        foreach ($eq->items as $item) {
            $wo->items()->create([
                'type' => $item->type,
                'product_id' => $item->product_id,
                'service_id' => $item->service_id,
                'description' => $item->custom_description,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'discount_percentage' => $item->discount_percentage,
                'subtotal' => $item->subtotal,
            ]);
        }

        // Copiar equipamento para pivô da OS
        if ($eq->equipment_id) {
            $wo->equipmentsList()->syncWithoutDetaching([
                $eq->equipment_id => ['observations' => $eq->observations ?? ''],
            ]);
        }
    }

    $quote->update(['status' => 'invoiced']);
    AuditLog::log('created', "OS criada a partir do orçamento {$quote->quote_number}", $wo);

        return response()->json($wo->load('items'), 201);
    }

    // ── Equipamentos ──

    public function addEquipment(Request $request, Quote $quote): JsonResponse
    {
        $validated = $request->validate([
            'equipment_id' => 'required|exists:equipments,id',
            'description' => 'nullable|string',
        ]);

        $eq = $quote->equipments()->create([
            ...$validated,
            'sort_order' => $quote->equipments()->count(),
        ]);

        return response()->json($eq->load('equipment'), 201);
    }

    public function removeEquipment(Quote $quote, QuoteEquipment $equipment): JsonResponse
    {
        $equipment->delete();
        $quote->recalculateTotal();
        return response()->json(null, 204);
    }

    // ── Itens ──

    public function addItem(Request $request, QuoteEquipment $equipment): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|in:product,service',
            'product_id' => 'nullable|exists:products,id',
            'service_id' => 'nullable|exists:services,id',
            'custom_description' => 'nullable|string',
            'quantity' => 'required|numeric|min:0.01',
            'original_price' => 'required|numeric|min:0',
            'unit_price' => 'required|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        $item = $equipment->items()->create([
            ...$validated,
            'sort_order' => $equipment->items()->count(),
        ]);

        return response()->json($item->load(['product', 'service']), 201);
    }

    public function removeItem(QuoteItem $item): JsonResponse
    {
        $item->delete();
        return response()->json(null, 204);
    }

    // ── Fotos ──

    public function addPhoto(Request $request, Quote $quote): JsonResponse
    {
        $request->validate([
            'file' => 'required|image|max:10240',
            'quote_equipment_id' => 'required|exists:quote_equipments,id',
            'caption' => 'nullable|string|max:255',
        ]);

        $path = $request->file('file')->store(
            "quotes/{$quote->id}/photos",
            'public'
        );

        $photo = QuotePhoto::create([
            'tenant_id' => auth()->user()->tenant_id,
            'quote_equipment_id' => $request->quote_equipment_id,
            'path' => $path,
            'caption' => $request->caption,
            'sort_order' => 0,
        ]);

        return response()->json($photo, 201);
    }

    public function removePhoto(QuotePhoto $photo): JsonResponse
    {
        \Illuminate\Support\Facades\Storage::disk('public')->delete($photo->path);
        $photo->delete();
        return response()->json(null, 204);
    }

    // ── Summary ──

    public function summary(): JsonResponse
    {
        $base = Quote::query();
        return response()->json([
            'draft' => (clone $base)->where('status', 'draft')->count(),
            'sent' => (clone $base)->where('status', 'sent')->count(),
            'approved' => (clone $base)->where('status', 'approved')->count(),
            'total_month' => (clone $base)->whereMonth('created_at', now()->month)->sum('total'),
            'conversion_rate' => $this->getConversionRate(),
        ]);
    }

    private function getConversionRate(): float
    {
        $sent = Quote::whereIn('status', ['approved', 'rejected', 'invoiced'])->count();
        if ($sent === 0) return 0;
        $approved = Quote::whereIn('status', ['approved', 'invoiced'])->count();
        return round(($approved / $sent) * 100, 1);
    }

    // ── Endpoints públicos (sem autenticação) ──

    public function publicView(Quote $quote, Request $request): JsonResponse
    {
        if (!Quote::verifyApprovalToken($quote->id, $request->query('token', ''))) {
            return response()->json(['message' => 'Token inválido'], 403);
        }

        return response()->json($quote->load([
            'customer:id,name',
            'equipments.items',
            'seller:id,name',
        ]));
    }

    public function publicApprove(Quote $quote, Request $request): JsonResponse
    {
        if (!Quote::verifyApprovalToken($quote->id, $request->query('token', ''))) {
            return response()->json(['message' => 'Token inválido'], 403);
        }

        if ($quote->status !== 'sent') {
            return response()->json(['message' => 'Orçamento não está disponível para aprovação'], 422);
        }

        if ($quote->isExpired()) {
            return response()->json(['message' => 'Orçamento expirado'], 422);
        }

        $quote->update([
            'status' => 'approved',
            'approved_at' => now(),
        ]);

        AuditLog::log('status_changed', "Orçamento {$quote->quote_number} aprovado pelo cliente via link público", $quote);

        return response()->json(['message' => 'Orçamento aprovado com sucesso', 'quote' => $quote->fresh()]);
    }
}
