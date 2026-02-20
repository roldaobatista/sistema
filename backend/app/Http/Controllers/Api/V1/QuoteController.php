<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\QuoteStatus;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ScopesByRole;
use App\Http\Requests\Quote\StoreQuoteRequest;
use App\Http\Requests\Quote\UpdateQuoteRequest;
use App\Models\AuditLog;
use App\Models\Quote;
use App\Models\QuoteEquipment;
use App\Models\QuoteItem;
use App\Models\QuotePhoto;
use App\Models\QuoteTag;
use App\Models\QuoteTemplate;
use App\Models\WorkOrder;
use App\Services\QuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class QuoteController extends Controller
{
    use ScopesByRole;

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
        $status = $quote->status instanceof QuoteStatus ? $quote->status : QuoteStatus::tryFrom($quote->status);
        if (!$status || !$status->isMutable()) {
            return response()->json(['message' => 'Só é possível editar orçamentos em rascunho ou rejeitados'], 422);
        }

        return null;
    }

    private function ensureCanApplyDiscount(Request $request, float $discountPercentage): ?JsonResponse
    {
        if ($discountPercentage > 0
            && !$request->user()->can('quotes.quote.apply_discount')
            && !$request->user()->can('os.work_order.apply_discount')
        ) {
            return response()->json(['message' => 'Apenas gerentes/admin podem aplicar descontos.'], 403);
        }

        return null;
    }

    public function index(Request $request): JsonResponse
    {
        $query = Quote::with(['customer:id,name', 'seller:id,name'])
            ->where('tenant_id', $this->currentTenantId())
            ->withCount('equipments');

        if ($this->shouldScopeByUser()) {
            $query->where('seller_id', auth()->id());
        }

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
        if ($dateFrom = $request->get('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo = $request->get('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $quotes = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        return response()->json($quotes);
    }

    public function store(StoreQuoteRequest $request): JsonResponse
    {
        try {
            $tenantId = $this->currentTenantId();
            $quote = $this->service->createQuote($request->validated(), $tenantId, (int) auth()->id());

            return response()->json(
                $quote->load(['customer', 'seller', 'equipments.equipment', 'equipments.items.product', 'equipments.items.service']),
                201
            );
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao criar orçamento'], 500);
        }
    }

    public function show(Quote $quote): JsonResponse
    {
        if ($quote->tenant_id !== $this->currentTenantId()) {
            return response()->json(['message' => 'Orçamento não encontrado'], 404);
        }

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

        $validated = $request->validated();
        if ($error = $this->ensureCanApplyDiscount($request, (float) ($validated['discount_percentage'] ?? 0))) {
            return $error;
        }

        try {
            $updatedQuote = $this->service->updateQuote($quote, $validated);
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

        // B4: Impedir exclusão se já convertido em OS
        $linkedWo = WorkOrder::where('quote_id', $quote->id)->first();
        if ($linkedWo) {
            $woNumber = $linkedWo->os_number ?? $linkedWo->number;
            return response()->json([
                'message' => "Orçamento vinculado à OS {$woNumber}. Exclua a OS primeiro.",
            ], 409);
        }

        try {
            DB::transaction(function () use ($quote) {
                foreach ($quote->equipments as $eq) {
                    foreach ($eq->photos as $photo) {
                        Storage::disk('public')->delete($photo->path);
                    }
                }
                $quote->delete();
                AuditLog::log('deleted', "Orçamento {$quote->quote_number} excluído", $quote);
            });

            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao excluir orçamento'], 500);
        }
    }

    // ── Ações de Negócio ──

    /**
     * Solicitar aprovação interna: draft -> pending_internal_approval.
     */
    public function requestInternalApproval(Quote $quote): JsonResponse
    {
        try {
            $this->service->requestInternalApproval($quote);
            return response()->json($quote->fresh()->load(['customer', 'seller', 'equipments.items']));
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao solicitar aprovação interna'], 500);
        }
    }

    public function send(Quote $quote): JsonResponse
    {
        try {
            $this->service->sendQuote($quote);
            return response()->json($quote->fresh()->load(['customer', 'seller', 'equipments.items']));
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
            return response()->json($quote->fresh()->load(['customer', 'seller', 'equipments.items']));
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao aprovar orçamento'], 500);
        }
    }

    /**
     * GAP-01: Internal approval (before sending to client).
     * Only quotes in 'draft' or 'pending_internal_approval' can be internally approved.
     */
    public function internalApprove(Quote $quote): JsonResponse
    {
        try {
            if (!in_array($quote->status, [QuoteStatus::DRAFT, QuoteStatus::PENDING_INTERNAL_APPROVAL], true)) {
                return response()->json(['message' => 'Orçamento não está em status que permite aprovação interna'], 422);
            }

            /** @var \App\Models\User $user */
            $user = auth()->user();

            DB::transaction(function () use ($quote, $user) {
                $quote->update([
                    'status' => QuoteStatus::INTERNALLY_APPROVED->value,
                    'internal_approved_by' => $user->id,
                    'internal_approved_at' => now(),
                ]);

                AuditLog::log('internal_approved', "Orçamento {$quote->quote_number} aprovado internamente por {$user->name}", $quote);
            });

            return response()->json($quote->fresh()->load(['customer', 'seller', 'equipments.items']));
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao aprovar internamente'], 500);
        }
    }

    public function reject(Request $request, Quote $quote): JsonResponse
    {
        try {
            $this->service->rejectQuote($quote, $request->get('reason'));
            return response()->json($quote->fresh()->load(['customer', 'seller', 'equipments.items']));
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao rejeitar orçamento'], 500);
        }
    }

    public function reopen(Quote $quote): JsonResponse
    {
        try {
            $this->service->reopenQuote($quote);
            return response()->json($quote->fresh());
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao reabrir orçamento'], 500);
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

    // ── Equipamentos, Itens e Fotos ──

    public function convertToServiceCall(Quote $quote): JsonResponse
    {
        try {
            $call = $this->service->convertToServiceCall($quote, (int) auth()->id());
            return response()->json($call, 201);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao converter orçamento em chamado'], 500);
        }
    }

    // ── Equipamentos, Itens e Fotos (original section continues) ──

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

        try {
            $eq = $quote->equipments()->create([
                'tenant_id' => $tenantId,
                ...$validated,
                'sort_order' => $quote->equipments()->count(),
            ]);

            return response()->json($eq->load('equipment'), 201);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao adicionar equipamento'], 500);
        }
    }

    public function removeEquipment(Quote $quote, QuoteEquipment $equipment): JsonResponse
    {
        if ($error = $this->ensureQuoteMutable($quote)) {
            return $error;
        }

        if ($equipment->quote_id !== $quote->id) {
            return response()->json(['message' => 'Equipamento não pertence a este orçamento'], 403);
        }

        try {
            DB::transaction(function () use ($equipment, $quote) {
                foreach ($equipment->photos as $photo) {
                    Storage::disk('public')->delete($photo->path);
                }
                $equipment->delete();
                $quote->recalculateTotal();
            });

            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao remover equipamento'], 500);
        }
    }

    public function updateEquipment(Request $request, QuoteEquipment $equipment): JsonResponse
    {
        $quote = $equipment->quote()->firstOrFail();
        if ($error = $this->ensureQuoteMutable($quote)) {
            return $error;
        }

        $validated = $request->validate([
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        try {
            $equipment = $this->service->updateEquipment($equipment, $validated);
            return response()->json($equipment);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao atualizar equipamento'], 500);
        }
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

        if ($error = $this->ensureCanApplyDiscount($request, (float) ($validated['discount_percentage'] ?? 0))) {
            return $error;
        }

        try {
            $item = DB::transaction(function () use ($equipment, $tenantId, $validated) {
                return $equipment->items()->create([
                    'tenant_id' => $tenantId,
                    ...$validated,
                    'sort_order' => $equipment->items()->count(),
                ]);
            });

            return response()->json($item->load(['product', 'service']), 201);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao adicionar item'], 500);
        }
    }

    public function updateItem(Request $request, QuoteItem $item): JsonResponse
    {
        $item->loadMissing('quoteEquipment.quote');
        $quote = $item->quoteEquipment?->quote;
        if ($quote && ($error = $this->ensureQuoteMutable($quote))) {
            return $error;
        }

        $validated = $request->validate([
            'custom_description' => 'nullable|string',
            'quantity' => 'sometimes|numeric|min:0.01',
            'original_price' => 'sometimes|numeric|min:0',
            'unit_price' => 'sometimes|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        if ($error = $this->ensureCanApplyDiscount($request, (float) ($validated['discount_percentage'] ?? 0))) {
            return $error;
        }

        try {
            $item = $this->service->updateItem($item, $validated);
            return response()->json($item);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao atualizar item'], 500);
        }
    }

    public function removeItem(QuoteItem $item): JsonResponse
    {
        $item->loadMissing('quoteEquipment.quote');
        $quote = $item->quoteEquipment?->quote;
        if ($quote && ($error = $this->ensureQuoteMutable($quote))) {
            return $error;
        }

        try {
            DB::transaction(function () use ($item, $quote) {
                $item->delete();
                $quote?->recalculateTotal();
            });
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
        $photo->loadMissing('quoteEquipment.quote');
        $quote = $photo->quoteEquipment?->quote;
        if ($quote && ($error = $this->ensureQuoteMutable($quote))) {
            return $error;
        }

        try {
            DB::transaction(function () use ($photo) {
                Storage::disk('public')->delete($photo->path);
                $photo->delete();
            });
            return response()->json(null, 204);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao remover foto'], 500);
        }
    }

    // ── Summary & Timeline ──

    public function summary(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $base = Quote::where('tenant_id', $tenantId);
        return response()->json([
            'draft' => (clone $base)->where('status', Quote::STATUS_DRAFT)->count(),
            'pending_internal_approval' => (clone $base)->where('status', Quote::STATUS_PENDING_INTERNAL)->count(),
            'internally_approved' => (clone $base)->where('status', Quote::STATUS_INTERNALLY_APPROVED)->count(),
            'sent' => (clone $base)->where('status', Quote::STATUS_SENT)->count(),
            'approved' => (clone $base)->where('status', Quote::STATUS_APPROVED)->count(),
            'invoiced' => (clone $base)->where('status', Quote::STATUS_INVOICED)->count(),
            'rejected' => (clone $base)->where('status', Quote::STATUS_REJECTED)->count(),
            'expired' => (clone $base)->where('status', Quote::STATUS_EXPIRED)->count(),
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

    public function timeline(Quote $quote): JsonResponse
    {
        $logs = AuditLog::where('auditable_type', Quote::class)
            ->where('auditable_id', $quote->id)
            ->where('tenant_id', $this->currentTenantId())
            ->orderByDesc('created_at')
            ->limit(50)
            ->get(['id', 'action', 'description', 'user_id', 'created_at']);

        return response()->json($logs);
    }

    public function exportCsv(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $tenantId = $this->currentTenantId();
        $query = Quote::with(['customer:id,name', 'seller:id,name'])
            ->where('tenant_id', $tenantId);

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $quotes = $query->orderByDesc('created_at')->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="orcamentos_' . now()->format('Y-m-d') . '.csv"',
        ];

        return response()->stream(function () use ($quotes) {
            $handle = fopen('php://output', 'w');
            fprintf($handle, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($handle, ['Número', 'Cliente', 'Vendedor', 'Status', 'Subtotal', 'Desconto', 'Total', 'Validade', 'Criado em'], ';');

            foreach ($quotes as $q) {
                $rawStatus = $q->status instanceof QuoteStatus ? $q->status->value : $q->status;
                $statusLabel = QuoteStatus::tryFrom($rawStatus)?->label() ?? $rawStatus;
                fputcsv($handle, [
                    $q->quote_number,
                    $q->customer?->name ?? '',
                    $q->seller?->name ?? '',
                    $statusLabel,
                    number_format((float) $q->subtotal, 2, ',', '.'),
                    number_format((float) $q->discount_amount, 2, ',', '.'),
                    number_format((float) $q->total, 2, ',', '.'),
                    $q->valid_until?->format('d/m/Y') ?? '',
                    $q->created_at?->format('d/m/Y H:i') ?? '',
                ], ';');
            }

            fclose($handle);
        }, 200, $headers);
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

    // ── New endpoints (30-improvements) ──

    public function sendEmail(Request $request, Quote $quote): JsonResponse
    {
        $request->validate([
            'recipient_email' => 'required|email',
            'recipient_name' => 'nullable|string|max:255',
            'message' => 'nullable|string',
        ]);

        try {
            $emailLog = $this->service->sendEmail(
                $quote,
                $request->input('recipient_email'),
                $request->input('recipient_name'),
                $request->input('message'),
                $request->user()->id,
            );

            return response()->json(['message' => 'E-mail enviado com sucesso', 'email' => $emailLog], 201);
        } catch (\Exception $e) {
            report($e);
            Log::error('Erro ao enviar e-mail: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['message' => 'Erro ao enviar e-mail'], 500);
        }
    }

    public function advancedSummary(): JsonResponse
    {
        return response()->json($this->service->advancedSummary($this->currentTenantId()));
    }

    public function tags(Quote $quote): JsonResponse
    {
        return response()->json($quote->tags);
    }

    public function syncTags(Request $request, Quote $quote): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $request->validate([
            'tag_ids' => 'required|array',
            'tag_ids.*' => ['integer', Rule::exists('quote_tags', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ]);
        $quote->tags()->sync($request->input('tag_ids'));
        return response()->json($quote->load('tags'));
    }

    public function listTags(): JsonResponse
    {
        $tags = QuoteTag::where('tenant_id', $this->currentTenantId())->orderBy('name')->get();
        return response()->json($tags);
    }

    public function storeTag(Request $request): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:100', 'color' => 'nullable|string|max:7']);
        $tag = QuoteTag::create([
            'tenant_id' => $this->currentTenantId(),
            'name' => $request->input('name'),
            'color' => $request->input('color', '#3B82F6'),
        ]);
        return response()->json($tag, 201);
    }

    public function destroyTag(QuoteTag $tag): JsonResponse
    {
        if ($tag->tenant_id !== $this->currentTenantId()) {
            return response()->json(['message' => 'Tag não encontrada'], 404);
        }
        $tag->delete();
        return response()->json(null, 204);
    }

    public function listTemplates(): JsonResponse
    {
        $templates = QuoteTemplate::where('tenant_id', $this->currentTenantId())
            ->where('is_active', true)
            ->orderBy('name')
            ->get();
        return response()->json($templates);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'default_items' => 'nullable|array',
            'payment_terms_text' => 'nullable|string',
            'validity_days' => 'nullable|integer|min:1',
        ]);

        $template = QuoteTemplate::create([
            'tenant_id' => $this->currentTenantId(),
            ...$request->only(['name', 'description', 'default_items', 'payment_terms_text', 'validity_days']),
        ]);

        return response()->json($template, 201);
    }

    public function updateTemplate(Request $request, QuoteTemplate $template): JsonResponse
    {
        if ($template->tenant_id !== $this->currentTenantId()) {
            return response()->json(['message' => 'Template não encontrado'], 404);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'default_items' => 'nullable|array',
            'payment_terms_text' => 'nullable|string',
            'validity_days' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        $template->update($request->only(['name', 'description', 'default_items', 'payment_terms_text', 'validity_days', 'is_active']));
        return response()->json($template);
    }

    public function destroyTemplate(QuoteTemplate $template): JsonResponse
    {
        if ($template->tenant_id !== $this->currentTenantId()) {
            return response()->json(['message' => 'Template não encontrado'], 404);
        }
        $template->delete();
        return response()->json(null, 204);
    }

    public function createFromTemplate(Request $request, QuoteTemplate $template): JsonResponse
    {
        $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'seller_id' => 'nullable|integer',
            'equipments' => 'required|array|min:1',
        ]);

        try {
            $quote = $this->service->createFromTemplate(
                $template,
                $request->all(),
                $this->currentTenantId(),
                $request->user()->id,
            );
            return response()->json($quote->load('equipments.items'), 201);
        } catch (\Exception $e) {
            report($e);
            Log::error($e->getMessage(), ['exception' => $e]);
            return response()->json(['message' => 'Erro ao criar orçamento a partir do template'], 500);
        }
    }

    public function compareQuotes(Request $request): JsonResponse
    {
        $request->validate(['ids' => 'required|array|min:2|max:5', 'ids.*' => 'integer']);
        $tenantId = $this->currentTenantId();

        $quotes = Quote::where('tenant_id', $tenantId)
            ->whereIn('id', $request->input('ids'))
            ->with(['equipments.items', 'customer:id,name', 'seller:id,name'])
            ->get();

        return response()->json($quotes);
    }

    public function compareRevisions(Quote $quote): JsonResponse
    {
        $revisions = Quote::where('tenant_id', $this->currentTenantId())
            ->where('quote_number', $quote->quote_number)
            ->with(['equipments.items'])
            ->orderBy('revision')
            ->get();

        return response()->json($revisions);
    }

    public function approveLevel2(Request $request, Quote $quote): JsonResponse
    {
        try {
            $updated = $this->service->internalApproveLevel2($quote, $request->user()->id);
            return response()->json(['message' => 'Aprovação nível 2 realizada', 'quote' => $updated]);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Erro ao aprovar nível 2'], 500);
        }
    }

    public function whatsappLink(Request $request, Quote $quote): JsonResponse
    {
        $phone = $request->query('phone');
        if (!$phone) {
            $quote->load('customer.contacts');
            $phone = $quote->customer?->contacts?->first()?->phone ?? $quote->customer?->phone;
        }
        if (!$phone) {
            return response()->json(['message' => 'Cliente sem telefone cadastrado'], 422);
        }

        $cleanPhone = preg_replace('/\D/', '', $phone);
        $message = urlencode("Olá! Segue o orçamento #{$quote->quote_number} no valor de R$ " . number_format((float) $quote->total, 2, ',', '.') . ". Para visualizar: {$quote->approval_url}");

        return response()->json([
            'url' => "https://wa.me/{$cleanPhone}?text={$message}",
            'phone' => $cleanPhone,
        ]);
    }

    public function installmentSimulation(Quote $quote): JsonResponse
    {
        return response()->json($quote->installmentSimulation());
    }
}
