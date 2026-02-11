<?php

namespace App\Http\Controllers\Api\V1\Os;

use App\Http\Controllers\Controller;
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
use Illuminate\Validation\Rule;

class WorkOrderController extends Controller
{
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

        $orders = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipment_id' => ['nullable', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'assigned_to' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'priority' => 'sometimes|in:low,normal,high,urgent',
            'description' => 'required|string',
            'internal_notes' => 'nullable|string',
            'received_at' => 'nullable|date',
            'discount' => 'numeric|min:0',
            // Novos campos v2
            'os_number' => 'nullable|string|max:30',
            'quote_id' => ['nullable', Rule::exists('quotes', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'service_call_id' => ['nullable', Rule::exists('service_calls', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'seller_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'origin_type' => ['nullable', \Illuminate\Validation\Rule::in([
                WorkOrder::ORIGIN_QUOTE,
                WorkOrder::ORIGIN_SERVICE_CALL,
                WorkOrder::ORIGIN_RECURRING,
                WorkOrder::ORIGIN_MANUAL,
                'direct', // Legacy/Frontend support
            ])],
            'discount_percentage' => 'numeric|min:0|max:100',
            'technician_ids' => 'nullable|array',
            'technician_ids.*' => [Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipment_ids' => 'nullable|array',
            'equipment_ids.*' => [Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            // Equipamento inline
            'new_equipment' => 'nullable|array',
            'new_equipment.type' => 'required_with:new_equipment|string|max:100',
            'new_equipment.brand' => 'nullable|string|max:100',
            'new_equipment.model' => 'nullable|string|max:100',
            'new_equipment.serial_number' => 'nullable|string|max:255',
            // Itens inline
            'items' => 'array',
            'items.*.type' => 'required|in:product,service',
            'items.*.reference_id' => 'nullable|integer',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'numeric|min:0.01',
            'items.*.unit_price' => 'numeric|min:0',
            'items.*.discount' => 'numeric|min:0',
        ]);

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
                    $order->technicians()->attach($techId, ['role' => 'technician']);
                }
            }
            if (!empty($validated['driver_id'])) {
                $order->technicians()->syncWithoutDetaching([$validated['driver_id'] => ['role' => 'driver']]);
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
        $data = $workOrder->load([
            'customer.contacts',
            'equipment',
            'branch:id,name',
            'creator:id,name',
            'assignee:id,name',
            'seller:id,name',
            'driver:id,name',
            'quote:id,quote_number,total',
            'serviceCall:id,call_number,status',
            'technicians:id,name',
            'equipmentsList',
            'items',
            'attachments',
            'statusHistory.user:id,name',
            'checklistResponses.item',
        ])->toArray();

        $data['allowed_transitions'] = WorkOrder::ALLOWED_TRANSITIONS[$workOrder->status] ?? [];

        return response()->json($data);
    }

    public function update(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'customer_id' => ['sometimes', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'equipment_id' => ['nullable', Rule::exists('equipments', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'assigned_to' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'priority' => 'sometimes|in:low,normal,high,urgent',
            'description' => 'sometimes|string',
            'internal_notes' => 'nullable|string',
            'technical_report' => 'nullable|string',
            'received_at' => 'nullable|date',
            'discount' => 'numeric|min:0',
            'os_number' => 'nullable|string|max:30',
            'seller_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'driver_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId))],
            'discount_percentage' => 'numeric|min:0|max:100',
            'displacement_value' => 'numeric|min:0',
        ]);

        $workOrder->update($validated);

        if (isset($validated['discount']) || isset($validated['discount_percentage']) || isset($validated['displacement_value'])) {
            $workOrder->recalculateTotal();
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

        $workOrder->delete();
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

        // #26 — Notificar técnico responsável e criador por email
        if (in_array($to, [WorkOrder::STATUS_COMPLETED, WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_CANCELLED, WorkOrder::STATUS_WAITING_APPROVAL])) {
            $notification = new \App\Notifications\WorkOrderStatusChanged($workOrder, $from, $to);
            $notifyIds = array_filter(array_unique([
                $workOrder->assigned_to,
                $workOrder->created_by,
            ]));
            $usersToNotify = \App\Models\User::whereIn('id', $notifyIds)
                ->where('id', '!=', $request->user()->id) // não notificar quem fez a ação
                ->get();
            foreach ($usersToNotify as $u) {
                $u->notify($notification);
            }
        }

        // Estorno de estoque ao cancelar — delegado ao HandleWorkOrderCancellation listener
        // (evita duplicidade de estorno)

        // Dispatch domain events
        $user = $request->user();
        match ($to) {
            WorkOrder::STATUS_IN_PROGRESS => WorkOrderStarted::dispatch($workOrder, $user),
            WorkOrder::STATUS_COMPLETED => WorkOrderCompleted::dispatch($workOrder, $user),
            WorkOrder::STATUS_INVOICED => WorkOrderInvoiced::dispatch($workOrder, $user),
            WorkOrder::STATUS_CANCELLED => WorkOrderCancelled::dispatch($workOrder, $user, $validated['notes'] ?? ''),
            default => null,
        };

        return response()->json($workOrder->fresh()->load('statusHistory.user:id,name'));
    }

    // --- Itens CRUD ---
    public function storeItem(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'type' => 'required|in:product,service',
            'reference_id' => 'nullable|integer',
            'description' => 'required|string',
            'quantity' => 'numeric|min:0.01',
            'unit_price' => 'numeric|min:0',
            'discount' => 'numeric|min:0',
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

        $item = $workOrder->items()->create($validated);
        // recalculateTotal já é chamado pelo hook WorkOrderItem::created
        return response()->json($item, 201);
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
            'quantity' => 'numeric|min:0.01',
            'unit_price' => 'numeric|min:0',
            'discount' => 'numeric|min:0',
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

        $item->update($validated);
        // recalculateTotal + estoque já são chamados pelo hook WorkOrderItem::updated
        return response()->json($item);
    }

    public function destroyItem(WorkOrder $workOrder, WorkOrderItem $item): JsonResponse
    {
        if ($item->work_order_id !== $workOrder->id) {
            return response()->json(['message' => 'Item não pertence a esta OS'], 403);
        }

        $item->delete();
        // recalculateTotal já é chamado pelo hook WorkOrderItem::deleted
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
            'file' => 'required|file|max:10240',
            'description' => 'nullable|string|max:255',
        ]);

        $file = $request->file('file');
        $path = $file->store("work-orders/{$workOrder->id}/attachments", 'public');

        $attachment = $workOrder->attachments()->create([
            'uploaded_by' => $request->user()->id,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'description' => $request->input('description'),
        ]);

        return response()->json($attachment->load('uploader:id,name'), 201);
    }

    public function destroyAttachment(WorkOrder $workOrder, \App\Models\WorkOrderAttachment $attachment): JsonResponse
    {
        if ($attachment->work_order_id !== $workOrder->id) {
            return response()->json(['message' => 'Anexo não pertence a esta OS'], 403);
        }

        \Illuminate\Support\Facades\Storage::disk('public')->delete($attachment->file_path);
        $attachment->delete();

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

        return response()->json([
            'message' => 'Assinatura registrada com sucesso',
            'signature_url' => asset("storage/{$path}"),
        ]);
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

        $workOrder->equipmentsList()->attach($validated['equipment_id']);

        return response()->json($workOrder->equipmentsList, 201);
    }

    public function detachEquipment(WorkOrder $workOrder, Equipment $equipment): JsonResponse
    {
        $workOrder->equipmentsList()->detach($equipment->id);
        return response()->json(null, 204);
    }
}
