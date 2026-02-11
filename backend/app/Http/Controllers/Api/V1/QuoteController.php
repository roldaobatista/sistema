<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Quote\StoreQuoteRequest;
use App\Http\Requests\Quote\UpdateQuoteRequest;
use App\Models\Quote;
use App\Models\QuoteEquipment;
use App\Models\QuoteItem;
use App\Models\QuotePhoto;
use App\Services\QuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;

class QuoteController extends Controller
{
    public function __construct(
        protected QuoteService $service
    ) {}

    private function currentTenantId(): int
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    private function ensureQuoteMutable(Quote $quote): ?JsonResponse
    {
        if (!in_array($quote->status, [Quote::STATUS_DRAFT, Quote::STATUS_REJECTED], true)) {
            return response()->json(['message' => 'Só é possível editar orçamentos em rascunho ou rejeitados'], 422);
        }

        return null;
    }

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

    public function store(StoreQuoteRequest $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        
        try {
            $quote = $this->service->createQuote($request->validated(), $tenantId, (int) auth()->id());

            return response()->json(
                $quote->load(['customer', 'seller', 'equipments.equipment', 'equipments.items']),
                201
            );
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao criar orçamento'], 500);
        }
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

    public function update(UpdateQuoteRequest $request, Quote $quote): JsonResponse
    {
        if ($error = $this->ensureQuoteMutable($quote)) {
            return $error;
        }

        try {
            $updatedQuote = $this->service->updateQuote($quote, $request->validated());
            return response()->json($updatedQuote->fresh(['customer', 'seller', 'equipments.items']));
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao atualizar orçamento'], 500);
        }
    }

    public function destroy(Quote $quote): JsonResponse
    {
        if ($error = $this->ensureQuoteMutable($quote)) {
            return $error;
        }
        $quote->delete();
        return response()->json(null, 204);
    }

    // ── Ações de Negócio ──

    public function send(Quote $quote): JsonResponse
    {
        try {
            $this->service->sendQuote($quote);
            return response()->json($quote);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao enviar orçamento'], 500);
        }
    }

    public function approve(Quote $quote): JsonResponse
    {
        try {
            /** @var \App\Models\User $user */
            $user = auth()->user();
            $this->service->approveQuote($quote, $user);
            return response()->json($quote);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao aprovar orçamento'], 500);
        }
    }

    public function reject(Request $request, Quote $quote): JsonResponse
    {
        try {
            $this->service->rejectQuote($quote, $request->get('reason'));
            return response()->json($quote);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao rejeitar orçamento'], 500);
        }
    }

    public function duplicate(Quote $quote): JsonResponse
    {
        try {
            $newQuote = $this->service->duplicateQuote($quote);
            return response()->json($newQuote->load(['customer', 'seller', 'equipments.items']), 201);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao duplicar orçamento'], 500);
        }
    }

    public function convertToWorkOrder(Quote $quote): JsonResponse
    {
        try {
            $wo = $this->service->convertToWorkOrder($quote, (int) auth()->id());
            return response()->json($wo->load('items'), 201);
        } catch (\App\Exceptions\QuoteAlreadyConvertedException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'work_order' => $e->workOrder->only(['id', 'number', 'os_number', 'status', 'business_number']),
            ], 409);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao converter orçamento em OS'], 500);
        }
    }

    // ── Equipamentos, Itens e Fotos (Manteremos aqui por enquanto, pois são manipulacoes diretas de filhos) ──
    // Poderiamos mover para o Service também, mas para manter o escopo focado na refatoração principal,
    // vamos deixar métodos menores aqui se não forem complexos demais.
    // Mas wait, a idea é limpar o controller. Vamos mover Add/Remove Equipment/Item para o service? 
    // Sim, é melhor. Mas para não estourar o escopo do prompt agora, vou manter, e se o user pedir mais refatoração fazemos.
    // O user pediu "via código... cada botao...". Então vamos manter o que já funciona bem e só encapsular transações.

    public function addEquipment(Request $request, Quote $quote): JsonResponse
    {
        if ($error = $this->ensureQuoteMutable($quote)) {
            return $error;
        }

        $tenantId = $this->currentTenantId();
        $validated = $request->validate([
            'equipment_id' => ['required', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'description' => 'nullable|string',
        ]);

        $eq = $quote->equipments()->create([
            'tenant_id' => $tenantId,
            ...$validated,
            'sort_order' => $quote->equipments()->count(),
        ]);

        return response()->json($eq->load('equipment'), 201);
    }

    public function removeEquipment(Quote $quote, QuoteEquipment $equipment): JsonResponse
    {
        if ($error = $this->ensureQuoteMutable($quote)) {
            return $error;
        }

        if ($equipment->quote_id !== $quote->id) {
            return response()->json(['message' => 'Equipamento não pertence a este orçamento'], 403);
        }

        DB::transaction(function () use ($equipment, $quote) {
            $equipment->delete();
            $quote->recalculateTotal();
        });

        return response()->json(null, 204);
    }

    public function addItem(Request $request, QuoteEquipment $equipment): JsonResponse
    {
        $quote = $equipment->quote()->firstOrFail();
        if ($error = $this->ensureQuoteMutable($quote)) {
            return $error;
        }

        $tenantId = $this->currentTenantId();
        $validated = $request->validate([
            'type' => 'required|in:product,service',
            'product_id' => ['nullable', 'required_if:type,product', Rule::exists('products', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'service_id' => ['nullable', 'required_if:type,service', Rule::exists('services', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'custom_description' => 'nullable|string',
            'quantity' => 'required|numeric|min:0.01',
            'original_price' => 'required|numeric|min:0',
            'unit_price' => 'required|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        try {
            $item = DB::transaction(function () use ($equipment, $tenantId, $validated) {
                $item = $equipment->items()->create([
                    'tenant_id' => $tenantId,
                    ...$validated,
                    'sort_order' => $equipment->items()->count(),
                ]);
                return $item;
            });

            return response()->json($item->load(['product', 'service']), 201);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao adicionar item'], 500);
        }
    }

    public function removeItem(QuoteItem $item): JsonResponse
    {
        $quote = $item->quoteEquipment?->quote;
        if ($quote && ($error = $this->ensureQuoteMutable($quote))) {
            return $error;
        }

        try {
            $item->delete(); // Recalculate triggered by model events
            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao remover item'], 500);
        }
    }

    public function addPhoto(Request $request, Quote $quote): JsonResponse
    {
        if ($error = $this->ensureQuoteMutable($quote)) {
            return $error;
        }

        $tenantId = $this->currentTenantId();
        $request->validate([
            'file' => 'required|image|max:10240',
            'quote_equipment_id' => [
                'required',
                Rule::exists('quote_equipments', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenantId)->where('quote_id', $quote->id)
                ),
            ],
            'caption' => 'nullable|string|max:255',
        ]);

        $path = $request->file('file')->store(
            "quotes/{$quote->id}/photos",
            'public'
        );

        if (!$path) {
            return response()->json(['message' => 'Erro ao salvar arquivo da foto'], 500);
        }

        $photo = QuotePhoto::create([
            'tenant_id' => $tenantId,
            'quote_equipment_id' => $request->quote_equipment_id,
            'path' => $path,
            'caption' => $request->caption,
            'sort_order' => 0,
        ]);

        return response()->json($photo, 201);
    }

    public function removePhoto(QuotePhoto $photo): JsonResponse
    {
        $quote = $photo->quoteEquipment?->quote;
        if ($quote && ($error = $this->ensureQuoteMutable($quote))) {
            return $error;
        }

        \Illuminate\Support\Facades\Storage::disk('public')->delete($photo->path);
        $photo->delete();
        return response()->json(null, 204);
    }

    // ── Summary ──

    public function summary(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $base = Quote::where('tenant_id', $tenantId);
        return response()->json([
            'draft' => (clone $base)->where('status', Quote::STATUS_DRAFT)->count(),
            'sent' => (clone $base)->where('status', Quote::STATUS_SENT)->count(),
            'approved' => (clone $base)->where('status', Quote::STATUS_APPROVED)->count(),
            'invoiced' => (clone $base)->where('status', Quote::STATUS_INVOICED)->count(),
            'total_month' => (clone $base)->whereMonth('created_at', now()->month)->whereYear('created_at', now()->year)->sum('total'),
            'conversion_rate' => $this->getConversionRate(),
        ]);
    }

    private function getConversionRate(): float
    {
        $tenantId = $this->currentTenantId();
        $sent = Quote::where('tenant_id', $tenantId)->whereIn('status', [Quote::STATUS_APPROVED, Quote::STATUS_REJECTED, Quote::STATUS_INVOICED])->count();
        if ($sent === 0) return 0;
        $approved = Quote::where('tenant_id', $tenantId)->whereIn('status', [Quote::STATUS_APPROVED, Quote::STATUS_INVOICED])->count();
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

        try {
            $this->service->publicApprove($quote);
            return response()->json(['message' => 'Orçamento aprovado com sucesso', 'quote' => $quote->fresh()]);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao aprovar orçamento'], 500);
        }
    }
}



