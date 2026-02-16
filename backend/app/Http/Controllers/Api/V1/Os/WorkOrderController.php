<?php

namespace App\Http\Controllers\Api\V1\Os;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ScopesByRole;
use App\Http\Requests\WorkOrder\StoreWorkOrderRequest;
use App\Http\Requests\WorkOrder\UpdateWorkOrderRequest;
use App\Models\Role;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Models\WorkOrderStatusHistory;
use App\Models\Equipment;
use App\Models\Product;
use App\Models\Service;
use App\Events\WorkOrderStarted;
use App\Events\WorkOrderCompleted;
use App\Events\WorkOrderInvoiced;
use App\Events\WorkOrderCancelled;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class WorkOrderController extends Controller
{
    use ScopesByRole;

    private function currentTenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    private function validateItemReference(string $type, ?int $referenceId, int $tenantId): ?string
    {
        if (!$referenceId) {
            return null;
        }

        $exists = match ($type) {
            'product' => Product::query()->where('tenant_id', $tenantId)->where('id', $referenceId)->exists(),
            'service' => Service::query()->where('tenant_id', $tenantId)->where('id', $referenceId)->exists(),
            default => false,
        };

        if ($exists) {
            return null;
        }

        $label = $type === 'product' ? 'produto' : 'serviço';
        return "Referência de {$label} inválida para este tenant.";
    }

    public function index(Request $request): JsonResponse
    {
        $query = WorkOrder::with([
            'customer:id,name,phone',
            'assignee:id,name',
            'equipment:id,type,brand,model',
            'seller:id,name',
            'quote:id,quote_number',
            'serviceCall:id,call_number',
        ]);

        $tenantId = $this->currentTenantId();
        $query->where('tenant_id', $tenantId);

        if ($this->shouldScopeByUser()) {
            $userId = auth()->id();
            $query->where(function ($q) use ($userId) {
                $q->where('assigned_to', $userId)->orWhere('created_by', $userId);
            });
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('os_number', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->get('status')) {
            if (str_contains($status, ',')) {
                $query->whereIn('status', explode(',', $status));
            } else {
                $query->where('status', $status);
            }
        }

        if ($priority = $request->get('priority')) {
            $query->where('priority', $priority);
        }

        if ($assignedTo = $request->get('assigned_to')) {
            $query->where('assigned_to', $assignedTo);
        }

        if ($customerId = $request->get('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($contractId = $request->get('recurring_contract_id')) {
            $query->where('recurring_contract_id', $contractId);
        }

        if ($equipmentId = $request->get('equipment_id')) {
            $query->where(function ($q) use ($equipmentId) {
                $q->where('equipment_id', $equipmentId)
                    ->orWhereHas('equipmentsList', fn($e) => $e->where('equipment_id', $equipmentId));
            });
        }

        if ($dateFrom = $request->get('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo = $request->get('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        // Contagem por status (todas as páginas) para quick stats do frontend
        $statusCounts = (clone $query)->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $orders = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        $response = $orders->toArray();
        $response['status_counts'] = $statusCounts;

        return response()->json($response);
    }

    public function store(StoreWorkOrderRequest $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $validated = $request->validated();

        // GAP-24: Gate de desconto — só admin/gerente pode aplicar
        $hasDiscount = (float) ($validated['discount'] ?? 0) > 0
            || (float) ($validated['discount_percentage'] ?? 0) > 0;
        if ($hasDiscount && !$request->user()->can('os.work_order.apply_discount')) {
            return response()->json([
                'message' => 'Apenas gerentes/admin podem aplicar descontos.',
            ], 403);
        }

        if (!empty($validated['items'])) {
            foreach ($validated['items'] as $index => $item) {
                $message = $this->validateItemReference(
                    (string) $item['type'],
                    isset($item['reference_id']) ? (int) $item['reference_id'] : null,
                    $tenantId
                );

                if ($message) {
                    return response()->json([
                        'message' => $message,
                        'errors' => ["items.{$index}.reference_id" => [$message]],
                    ], 422);
                }
            }
        }

        $order = DB::transaction(function () use ($validated, $tenantId, $request) {
            // Equipamento inline
            if (!empty($validated['new_equipment'])) {
                $equip = Equipment::create([
                    ...$validated['new_equipment'],
                    'tenant_id' => $tenantId,
                    'customer_id' => $validated['customer_id'],
                ]);
                $validated['equipment_id'] = $equip->id;
            }

            $order = WorkOrder::create([
                ...collect($validated)->except(['items', 'new_equipment', 'technician_ids', 'equipment_ids'])->toArray(),
                'number' => WorkOrder::nextNumber($tenantId),
                'tenant_id' => $tenantId,
                'created_by' => $request->user()->id,
                'status' => WorkOrder::STATUS_OPEN,
            ]);

            // Pivô técnicos
            if (!empty($validated['technician_ids'])) {
                foreach ($validated['technician_ids'] as $techId) {
                    $order->technicians()->attach($techId, ['role' => Role::TECNICO]);
                }
            }
            if (!empty($validated['driver_id'])) {
                $order->technicians()->syncWithoutDetaching([$validated['driver_id'] => ['role' => Role::MOTORISTA]]);
            }

            // Pivô equipamentos
            if (!empty($validated['equipment_ids'])) {
                $order->equipmentsList()->attach($validated['equipment_ids']);
            }

            // Itens
            if (!empty($validated['items'])) {
                foreach ($validated['items'] as $item) {
                    $order->items()->create($item);
                }
            }

            // Timeline
            $order->statusHistory()->create([
                'tenant_id' => $tenantId,
                'user_id' => $request->user()->id,
                'from_status' => null,
                'to_status' => WorkOrder::STATUS_OPEN,
                'notes' => 'OS criada',
            ]);

            return $order;
        });

        // Garantia alert
        $warrantyWarning = null;
        if ($order->equipment_id) {
            $equip = Equipment::find($order->equipment_id);
            if ($equip && $equip->warranty_expires_at && !$equip->warranty_expires_at->isPast()) {
                $warrantyWarning = "Equipamento {$equip->code} está em garantia até {$equip->warranty_expires_at->format('d/m/Y')}. Verificar cobertura antes de faturar.";
            }
        }

        return response()->json([
            'data' => $order->load(['customer', 'equipment', 'assignee:id,name', 'seller:id,name', 'technicians', 'equipmentsList', 'items', 'statusHistory.user:id,name']),
            'warranty_warning' => $warrantyWarning,
        ], 201);
    }

    public function show(WorkOrder $workOrder): JsonResponse
    {
        $workOrder->load([
            'customer:id,name',
            'equipment:id,name,serial_number',
            'serviceCall:id,call_number,status',
            'assignee:id,name',
            'items.product:id,name',
            'items.service:id,name',
            'attachments.uploader:id,name',
            'statusHistory.user:id,name',
            'parent:id,os_number,number',
            'children:id,os_number,number,status',
            'customer.contacts',
            'branch:id,name',
            'creator:id,name',
            'seller:id,name',
            'driver:id,name',
            'quote:id,quote_number,total',
            'serviceCall:id,call_number,status',
            'technicians:id,name',
            'equipmentsList',
            'items',
            'attachments',
            'checklistResponses.item',
        ]);

        $data = $workOrder->toArray();
        $data['allowed_transitions'] = WorkOrder::ALLOWED_TRANSITIONS[$workOrder->status] ?? [];

        return response()->json($data);
    }

    public function update(UpdateWorkOrderRequest $request, WorkOrder $workOrder): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $validated = $request->validated();

        // GAP-24: Gate de desconto — só admin/gerente pode aplicar
        $hasDiscount = (float) ($validated['discount'] ?? 0) > 0
            || (float) ($validated['discount_percentage'] ?? 0) > 0;
        if ($hasDiscount && !$request->user()->can('os.work_order.apply_discount')) {
            return response()->json([
                'message' => 'Apenas gerentes/admin podem aplicar descontos.',
            ], 403);
        }

        try {
            DB::beginTransaction();
            $workOrder->update($validated);

            if (isset($validated['discount']) || isset($validated['discount_percentage']) || isset($validated['displacement_value'])) {
                $workOrder->recalculateTotal();
            }
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder update failed', ['id' => $workOrder->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar OS'], 500);
        }

        return response()->json($workOrder->fresh()->load([
            'customer', 'equipment', 'assignee:id,name', 'seller:id,name',
            'technicians', 'equipmentsList', 'items', 'statusHistory.user:id,name',
        ]));
    }

    public function destroy(WorkOrder $workOrder): JsonResponse
    {
        if (in_array($workOrder->status, [WorkOrder::STATUS_COMPLETED, WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_INVOICED])) {
            return response()->json(['message' => 'Não é possível excluir OS concluída, entregue ou faturada'], 422);
        }

        $hasPayments = \App\Models\AccountReceivable::where('work_order_id', $workOrder->id)->exists();
        $hasCommissions = \App\Models\CommissionEvent::where('work_order_id', $workOrder->id)->exists();

        if ($hasPayments || $hasCommissions) {
            $blocks = [];
            if ($hasPayments) $blocks[] = 'títulos financeiros';
            if ($hasCommissions) $blocks[] = 'comissões';
            return response()->json([
                'message' => 'Não é possível excluir esta OS — possui ' . implode(' e ', $blocks) . ' vinculados',
            ], 409);
        }

        try {
            DB::beginTransaction();
            $workOrder->delete();
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder delete failed', ['id' => $workOrder->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir OS'], 500);
        }

        return response()->json(null, 204);
    }

    // --- Status Transition ---
    public function updateStatus(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:' . implode(',', array_keys(WorkOrder::STATUSES)),
            'notes' => 'nullable|string',
        ]);

        $from = $workOrder->status;
        $to = $validated['status'];

        if (!$workOrder->canTransitionTo($to)) {
            $fromLabel = WorkOrder::STATUSES[$from]['label'] ?? $from;
            $toLabel = WorkOrder::STATUSES[$to]['label'] ?? $to;
            return response()->json([
                'message' => "Transição inválida: {$fromLabel} → {$toLabel}",
                'allowed' => WorkOrder::ALLOWED_TRANSITIONS[$from] ?? [],
            ], 422);
        }

        if ($to === WorkOrder::STATUS_COMPLETED && $workOrder->checklist_id) {
            $requiredItemsCount = $workOrder->checklist->items()->count();
            $providedResponsesCount = $workOrder->checklistResponses()->count();

            if ($providedResponsesCount < $requiredItemsCount) {
                return response()->json([
                    'message' => 'O checklist desta OS está incompleto. Todos os itens devem ser respondidos antes de concluir.',
                    'required_items' => $requiredItemsCount,
                    'provided_responses' => $providedResponsesCount,
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            $workOrder->update([
                'status' => $to,
                'started_at' => $to === WorkOrder::STATUS_IN_PROGRESS && !$workOrder->started_at ? now() : $workOrder->started_at,
                'completed_at' => $to === WorkOrder::STATUS_COMPLETED ? now() : $workOrder->completed_at,
                'delivered_at' => $to === WorkOrder::STATUS_DELIVERED ? now() : $workOrder->delivered_at,
            ]);

            // statusHistory criado apenas para transições sem Listener dedicado
            // Os Listeners WorkOrderStarted, Completed, Cancelled, Invoiced já criam seus próprios registros
            if (!in_array($to, [WorkOrder::STATUS_IN_PROGRESS, WorkOrder::STATUS_COMPLETED, WorkOrder::STATUS_CANCELLED, WorkOrder::STATUS_INVOICED])) {
                $workOrder->statusHistory()->create([
                    'tenant_id' => $workOrder->tenant_id,
                    'user_id' => $request->user()->id,
                    'from_status' => $from,
                    'to_status' => $to,
                    'notes' => $validated['notes'] ?? null,
                ]);
            }

            // Automate System Chat Message for Status Change (Brainstorm #13 / Wave 1)
            $workOrder->chats()->create([
                'tenant_id' => $workOrder->tenant_id,
                'user_id' => $request->user()->id,
                'type' => 'system',
                'message' => "OS alterada de **" . (WorkOrder::STATUSES[$from]['label'] ?? $from) . "** para **" . (WorkOrder::STATUSES[$to]['label'] ?? $to) . "**" . (isset($validated['notes']) && $validated['notes'] ? ": {$validated['notes']}" : ""),
            ]);

            // #26 — Notificar técnico responsável e criador por email
            if (in_array($to, [WorkOrder::STATUS_COMPLETED, WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_CANCELLED, WorkOrder::STATUS_WAITING_APPROVAL])) {
                $notification = new \App\Notifications\WorkOrderStatusChanged($workOrder, $from, $to);
                $notifyIds = array_filter(array_unique([
                    $workOrder->assigned_to,
                    $workOrder->created_by,
                ]));
                $usersToNotify = \App\Models\User::whereIn('id', $notifyIds)
                    ->where('id', '!=', $request->user()->id)
                    ->get();
                foreach ($usersToNotify as $u) {
                    $u->notify($notification);
                }
            }

            DB::commit();

            // Dispatch domain events AFTER commit to prevent race conditions
            $user = $request->user();
            match ($to) {
                WorkOrder::STATUS_IN_PROGRESS => WorkOrderStarted::dispatch($workOrder, $user, $from),
                WorkOrder::STATUS_COMPLETED => WorkOrderCompleted::dispatch($workOrder, $user, $from),
                WorkOrder::STATUS_INVOICED => WorkOrderInvoiced::dispatch($workOrder, $user, $from),
                WorkOrder::STATUS_CANCELLED => WorkOrderCancelled::dispatch($workOrder, $user, $validated['notes'] ?? '', $from),
                default => null,
            };

            event(new \App\Events\WorkOrderStatusChanged($workOrder));

            return response()->json($workOrder->fresh()->load(['customer:id,name,latitude,longitude', 'statusHistory.user:id,name']));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder status update failed', [
                'work_order_id' => $workOrder->id,
                'from' => $from,
                'to' => $to,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Erro ao alterar status da OS'], 500);
        }
    }

    // --- Itens CRUD ---
    public function storeItem(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'type' => 'required|in:product,service',
            'reference_id' => 'nullable|integer',
            'description' => 'required|string',
            'quantity' => 'sometimes|numeric|min:0.01',
            'unit_price' => 'sometimes|numeric|min:0',
            'discount' => 'sometimes|numeric|min:0',
        ]);

        $message = $this->validateItemReference(
            $validated['type'],
            isset($validated['reference_id']) ? (int) $validated['reference_id'] : null,
            $tenantId
        );

        if ($message) {
            return response()->json([
                'message' => $message,
                'errors' => ['reference_id' => [$message]],
            ], 422);
        }

        try {
            DB::beginTransaction();
            $item = $workOrder->items()->create($validated);
            DB::commit();
            return response()->json($item, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder addItem failed', ['wo_id' => $workOrder->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao adicionar item'], 500);
        }
    }

    public function updateItem(Request $request, WorkOrder $workOrder, WorkOrderItem $item): JsonResponse
    {
        if ($item->work_order_id !== $workOrder->id) {
            return response()->json(['message' => 'Item não pertence a esta OS'], 403);
        }

        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'type' => 'sometimes|in:product,service',
            'reference_id' => 'nullable|integer',
            'description' => 'sometimes|string',
            'quantity' => 'sometimes|numeric|min:0.01',
            'unit_price' => 'sometimes|numeric|min:0',
            'discount' => 'sometimes|numeric|min:0',
        ]);

        $type = $validated['type'] ?? $item->type;
        $refId = array_key_exists('reference_id', $validated) ? $validated['reference_id'] : $item->reference_id;

        $message = $this->validateItemReference($type, $refId ? (int) $refId : null, $tenantId);
        if ($message) {
            return response()->json([
                'message' => $message,
                'errors' => ['reference_id' => [$message]],
            ], 422);
        }

        try {
            DB::beginTransaction();
            $item->update($validated);
            DB::commit();
            return response()->json($item);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder updateItem failed', ['item_id' => $item->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar item'], 500);
        }
    }

    public function destroyItem(WorkOrder $workOrder, WorkOrderItem $item): JsonResponse
    {
        if ($item->work_order_id !== $workOrder->id) {
            return response()->json(['message' => 'Item não pertence a esta OS'], 403);
        }

        try {
            DB::beginTransaction();
            $item->delete();
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder deleteItem failed', ['item_id' => $item->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover item'], 500);
        }

        return response()->json(null, 204);
    }

    // --- Metadata (statuses, priorities) ---
    public function metadata(): JsonResponse
    {
        return response()->json([
            'statuses' => WorkOrder::STATUSES,
            'priorities' => WorkOrder::PRIORITIES,
        ]);
    }

    // --- Fotos/Anexos ---

    public function attachments(WorkOrder $workOrder): JsonResponse
    {
        return response()->json($workOrder->attachments()->with('uploader:id,name')->get());
    }

    public function storeAttachment(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                'max:51200', // 50MB
                'mimetypes:image/jpeg,image/png,image/gif,application/pdf,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska'
            ],
            'description' => 'nullable|string|max:255',
        ]);

        try {
            DB::beginTransaction();

            $file = $request->file('file');
            $path = $file->store("work-orders/{$workOrder->id}/attachments", 'public');

            $attachment = $workOrder->attachments()->create([
                'tenant_id' => $this->currentTenantId(),
                'uploaded_by' => $request->user()->id,
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $path,
                'file_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'description' => $request->input('description'),
            ]);

            DB::commit();

            return response()->json($attachment->load('uploader:id,name'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder storeAttachment failed', ['wo_id' => $workOrder->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao enviar anexo'], 500);
        }
    }

    public function destroyAttachment(WorkOrder $workOrder, \App\Models\WorkOrderAttachment $attachment): JsonResponse
    {
        if ($attachment->work_order_id !== $workOrder->id) {
            return response()->json(['message' => 'Anexo não pertence a esta OS'], 403);
        }

        try {
            DB::beginTransaction();
            \Illuminate\Support\Facades\Storage::disk('public')->delete($attachment->file_path);
            $attachment->delete();
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder destroyAttachment failed', ['attachment_id' => $attachment->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover anexo'], 500);
        }

        return response()->json(null, 204);
    }

    /**
     * #30 — Assinatura digital do cliente na entrega da OS.
     * POST /work-orders/{work_order}/signature
     */
    public function storeSignature(WorkOrder $workOrder, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'signature' => 'required|string', // base64 PNG
            'signer_name' => 'required|string|max:255',
        ]);

        if (!in_array($workOrder->status, [WorkOrder::STATUS_COMPLETED, WorkOrder::STATUS_DELIVERED])) {
            return response()->json([
                'message' => 'Assinatura só pode ser registrada em OS completada ou entregue',
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Decode base64 and save
            $imageData = base64_decode(
                preg_replace('#^data:image/\w+;base64,#i', '', $validated['signature'])
            );

            $path = "signatures/wo_{$workOrder->id}_" . time() . '.png';
            \Illuminate\Support\Facades\Storage::disk('public')->put($path, $imageData);

            $workOrder->update([
                'signature_path' => $path,
                'signature_signer' => $validated['signer_name'],
                'signature_at' => now(),
                'signature_ip' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Assinatura registrada com sucesso',
                'signature_url' => asset("storage/{$path}"),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder storeSignature failed', ['wo_id' => $workOrder->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao salvar assinatura'], 500);
        }
    }

    // --- Equipamentos múltiplos na OS ---

    public function attachEquipment(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'equipment_id' => ['required', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
        ]);

        if ($workOrder->equipmentsList()->where('equipment_id', $validated['equipment_id'])->exists()) {
            return response()->json(['message' => 'Equipamento já vinculado a esta OS'], 422);
        }

        try {
            DB::beginTransaction();
            $workOrder->equipmentsList()->attach($validated['equipment_id']);
            DB::commit();

            return response()->json($workOrder->fresh()->equipmentsList, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder attachEquipment failed', ['wo_id' => $workOrder->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao vincular equipamento'], 500);
        }
    }

    public function detachEquipment(WorkOrder $workOrder, Equipment $equipment): JsonResponse
    {
        if ($equipment->tenant_id !== $workOrder->tenant_id) {
            return response()->json(['message' => 'Equipamento não pertence a este tenant'], 403);
        }

        try {
            DB::beginTransaction();
            $workOrder->equipmentsList()->detach($equipment->id);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder detachEquipment failed', ['wo_id' => $workOrder->id, 'equipment_id' => $equipment->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao desvincular equipamento'], 500);
        }

        return response()->json(null, 204);
    }

    // --- Duplicar OS ---

    public function duplicate(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        try {
            DB::beginTransaction();

            $newOrder = $workOrder->replicate(['number', 'os_number', 'status', 'started_at', 'completed_at', 'delivered_at', 'cancelled_at', 'cancellation_reason', 'signature_path', 'signed_by_name', 'signature_at', 'invoice_id']);
            $newOrder->number = WorkOrder::nextNumber($tenantId);
            $newOrder->status = WorkOrder::STATUS_OPEN;
            $newOrder->created_by = $request->user()->id;
            $newOrder->total = '0.00';
            $newOrder->save();

            // Clone items
            foreach ($workOrder->items as $item) {
                $newItem = $item->replicate(['work_order_id']);
                $newItem->work_order_id = $newOrder->id;
                $newItem->save();
            }

            // Clone equipment links
            $equipIds = $workOrder->equipmentsList()->pluck('equipment_id')->toArray();
            if (!empty($equipIds)) {
                $newOrder->equipmentsList()->attach($equipIds);
            }

            // Clone technicians
            $techIds = $workOrder->technicians()->pluck('user_id')->toArray();
            if (!empty($techIds)) {
                $newOrder->technicians()->attach($techIds);
            }

            $newOrder->recalculateTotal();

            DB::commit();

            return response()->json([
                'message' => 'OS duplicada com sucesso',
                'data' => $newOrder->fresh()->load(['customer', 'items', 'equipmentsList']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder duplicate failed', ['source_id' => $workOrder->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao duplicar OS'], 500);
        }
    }

    // --- Exportar CSV ---

    public function exportCsv(Request $request)
    {
        $query = WorkOrder::with(['customer:id,name', 'assignee:id,name'])
            ->orderByDesc('created_at');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }
        if ($priority = $request->get('priority')) {
            $query->where('priority', $priority);
        }
        if ($from = $request->get('date_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('date_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $orders = $query->get();

        $callback = function () use ($orders) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Número', 'Status', 'Prioridade', 'Cliente', 'Técnico', 'Total', 'Criado em', 'Concluído em']);
            foreach ($orders as $wo) {
                fputcsv($out, [
                    $wo->business_number,
                    WorkOrder::STATUSES[$wo->status]['label'] ?? $wo->status,
                    WorkOrder::PRIORITIES[$wo->priority]['label'] ?? $wo->priority,
                    $wo->customer?->name ?? '—',
                    $wo->assignee?->name ?? '—',
                    number_format((float) $wo->total, 2, ',', '.'),
                    $wo->created_at?->format('d/m/Y H:i') ?? '',
                    $wo->completed_at?->format('d/m/Y H:i') ?? '',
                ]);
            }
            fclose($out);
        };

        $filename = 'os_export_' . now()->format('Y-m-d_His') . '.csv';

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ]);
    }

    // --- Dashboard Stats ---

    public function dashboardStats(Request $request): JsonResponse
    {
        $base = WorkOrder::query();

        // Status counts
        $statusCounts = (clone $base)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        // Avg completion time (in hours)
        $avgCompletionHours = (clone $base)
            ->whereNotNull('completed_at')
            ->whereNotNull('started_at')
            ->select('started_at', 'completed_at')
            ->get()
            ->avg(fn ($row) => \Carbon\Carbon::parse($row->started_at)->diffInHours(\Carbon\Carbon::parse($row->completed_at)));

        // Revenue this month
        $monthRevenue = (clone $base)
            ->where('status', WorkOrder::STATUS_INVOICED)
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum('total');

        // SLA compliance
        $totalWithSla = (clone $base)->whereNotNull('sla_due_at')->count();
        $slaBreached = (clone $base)
            ->whereNotNull('sla_due_at')
            ->whereColumn('completed_at', '>', 'sla_due_at')
            ->count();
        $slaCompliance = $totalWithSla > 0 ? round((($totalWithSla - $slaBreached) / $totalWithSla) * 100, 1) : 100;

        // Top 5 customers
        $topCustomers = (clone $base)
            ->join('customers', 'work_orders.customer_id', '=', 'customers.id')
            ->select('customers.name', DB::raw('count(*) as total_os'), DB::raw('sum(work_orders.total) as revenue'))
            ->groupBy('customers.id', 'customers.name')
            ->orderByDesc('total_os')
            ->limit(5)
            ->get();

        return response()->json([
            'status_counts' => $statusCounts,
            'avg_completion_hours' => round((float) $avgCompletionHours, 1),
            'month_revenue' => number_format((float) $monthRevenue, 2, '.', ''),
            'sla_compliance' => $slaCompliance,
            'total_orders' => (clone $base)->count(),
            'top_customers' => $topCustomers,
        ]);
    }

    // --- Reabrir OS cancelada ---

    public function reopen(Request $request, WorkOrder $workOrder): JsonResponse
    {
        if ($workOrder->status !== WorkOrder::STATUS_CANCELLED) {
            return response()->json(['message' => 'Apenas OS canceladas podem ser reabertas'], 422);
        }

        try {
            DB::beginTransaction();

            $workOrder->update([
                'status' => WorkOrder::STATUS_OPEN,
            ]);

            WorkOrderStatusHistory::create([
                'tenant_id' => $workOrder->tenant_id,
                'work_order_id' => $workOrder->id,
                'user_id' => $request->user()->id,
                'from_status' => WorkOrder::STATUS_CANCELLED,
                'to_status' => WorkOrder::STATUS_OPEN,
                'notes' => 'OS reaberta',
            ]);

            DB::commit();

            return response()->json($workOrder->fresh()->load(['customer:id,name,latitude,longitude', 'statusHistory.user:id,name']));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder reopen failed', ['id' => $workOrder->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao reabrir OS'], 500);
        }
    }

    /**
     * GAP-02: Authorize dispatch for a work order.
     * Records who authorized and creates a status history entry.
     */
    public function authorizeDispatch(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $allowedStatuses = [WorkOrder::STATUS_OPEN, WorkOrder::STATUS_IN_PROGRESS];
        if (!in_array($workOrder->status, $allowedStatuses, true)) {
            return response()->json([
                'message' => 'Autorização de deslocamento só é permitida para OS abertas ou em andamento',
            ], 422);
        }

        if ($workOrder->dispatch_authorized_at) {
            return response()->json([
                'message' => 'Deslocamento já autorizado em ' . $workOrder->dispatch_authorized_at->format('d/m/Y H:i'),
            ], 422);
        }

        try {
            DB::beginTransaction();

            $workOrder->update([
                'dispatch_authorized_by' => $request->user()->id,
                'dispatch_authorized_at' => now(),
            ]);

            WorkOrderStatusHistory::create([
                'tenant_id' => $workOrder->tenant_id,
                'work_order_id' => $workOrder->id,
                'user_id' => $request->user()->id,
                'from_status' => $workOrder->status,
                'to_status' => $workOrder->status,
                'notes' => 'Deslocamento autorizado',
            ]);

            DB::commit();

            return response()->json($workOrder->fresh()->load(['customer:id,name,latitude,longitude', 'statusHistory.user:id,name', 'driver:id,name']));
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrder authorizeDispatch failed', ['id' => $workOrder->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao autorizar deslocamento'], 500);
        }
    }
    /**
     * GET /work-orders/{work_order}/audit-trail
     * Returns all audit log entries related to this work order.
     */
    public function auditTrail(WorkOrder $workOrder): JsonResponse
    {
        $logs = \App\Models\AuditLog::with('user:id,name')
            ->where(function ($q) use ($workOrder) {
                // Direct WO changes
                $q->where(function ($sub) use ($workOrder) {
                    $sub->where('auditable_type', WorkOrder::class)
                        ->where('auditable_id', $workOrder->id);
                })
                // Item changes
                ->orWhere(function ($sub) use ($workOrder) {
                    $sub->where('auditable_type', WorkOrderItem::class)
                        ->whereIn('auditable_id', $workOrder->items()->pluck('id'));
                });
            })
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'action_label' => \App\Models\AuditLog::ACTIONS[$log->action] ?? $log->action,
                    'description' => $log->description,
                    'entity_type' => $log->auditable_type ? class_basename($log->auditable_type) : null,
                    'entity_id' => $log->auditable_id,
                    'user' => $log->user,
                    'old_values' => $log->old_values,
                    'new_values' => $log->new_values,
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at,
                ];
            });

        // Also include status history and chat system messages for a complete timeline
        $statusHistory = $workOrder->statusHistory()
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($h) {
                return [
                    'id' => 'sh_' . $h->id,
                    'action' => 'status_changed',
                    'action_label' => 'Status Alterado',
                    'description' => ($h->from_status ? "De {$h->from_status} " : '') . "para {$h->to_status}" . ($h->notes ? ": {$h->notes}" : ''),
                    'entity_type' => 'WorkOrder',
                    'entity_id' => $h->work_order_id,
                    'user' => $h->user,
                    'old_values' => ['status' => $h->from_status],
                    'new_values' => ['status' => $h->to_status],
                    'ip_address' => null,
                    'created_at' => $h->created_at,
                ];
            });

        $combined = $logs->concat($statusHistory)
            ->sortByDesc('created_at')
            ->values();

        return response()->json(['data' => $combined]);
    }

    public function satisfaction(WorkOrder $workOrder): JsonResponse
    {
        $survey = \App\Models\SatisfactionSurvey::where('work_order_id', $workOrder->id)->first();

        if (!$survey) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => $survey]);
    }
}
