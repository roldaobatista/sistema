<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Http\Controllers\Controller;
use App\Models\StockTransfer;
use App\Models\Warehouse;
use App\Services\StockTransferService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class StockTransferController extends Controller
{
    use ResolvesCurrentTenant;

    public function __construct(
        private readonly StockTransferService $transferService
    ) {}

    /**
     * Listar transferências com filtros (direção empresa↔caminhão, empresa↔técnico, etc.)
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $query = StockTransfer::with(['fromWarehouse', 'toWarehouse', 'toUser:id,name', 'items.product:id,name,code,unit'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('from_warehouse_id')) {
            $query->where('from_warehouse_id', $request->from_warehouse_id);
        }
        if ($request->filled('to_warehouse_id')) {
            $query->where('to_warehouse_id', $request->to_warehouse_id);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }
        if ($request->filled('to_user_id')) {
            $query->where('to_user_id', $request->to_user_id);
        }

        if ($request->filled('direction')) {
            $this->applyDirectionFilter($query, $request->direction);
        }

        if ($request->boolean('my_pending')) {
            $query->where('to_user_id', auth()->id())->where('status', StockTransfer::STATUS_PENDING_ACCEPTANCE);
        }

        $transfers = $query->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json($transfers);
    }

    protected function applyDirectionFilter($query, string $direction): void
    {
        $centralIds = Warehouse::where('type', Warehouse::TYPE_FIXED)
            ->whereNull('user_id')
            ->whereNull('vehicle_id')
            ->pluck('id');
        $vehicleIds = Warehouse::where('type', Warehouse::TYPE_VEHICLE)->pluck('id');
        $technicianIds = Warehouse::where('type', Warehouse::TYPE_TECHNICIAN)->pluck('id');

        match ($direction) {
            'company_to_vehicle' => $query->whereIn('from_warehouse_id', $centralIds)->whereIn('to_warehouse_id', $vehicleIds),
            'vehicle_to_company' => $query->whereIn('from_warehouse_id', $vehicleIds)->whereIn('to_warehouse_id', $centralIds),
            'company_to_technician' => $query->whereIn('from_warehouse_id', $centralIds)->whereIn('to_warehouse_id', $technicianIds),
            'vehicle_to_technician' => $query->whereIn('from_warehouse_id', $vehicleIds)->whereIn('to_warehouse_id', $technicianIds),
            'technician_to_company' => $query->whereIn('from_warehouse_id', $technicianIds)->whereIn('to_warehouse_id', $centralIds),
            default => null,
        };
    }

    public function show(StockTransfer $transfer): JsonResponse
    {
        $this->authorizeTenant($transfer);
        $transfer->load(['fromWarehouse', 'toWarehouse', 'toUser', 'acceptedByUser', 'rejectedByUser', 'items.product']);
        return response()->json($transfer);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->resolvedTenantId();

        $validated = $request->validate([
            'from_warehouse_id' => "required|exists:warehouses,id,tenant_id,{$tenantId}",
            'to_warehouse_id' => "required|exists:warehouses,id,tenant_id,{$tenantId}|different:from_warehouse_id",
            'items' => 'required|array|min:1',
            'items.*.product_id' => "required|exists:products,id,tenant_id,{$tenantId}",
            'items.*.quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            $transfer = $this->transferService->createTransfer(
                $validated['from_warehouse_id'],
                $validated['to_warehouse_id'],
                $validated['items'],
                $validated['notes'] ?? null,
                auth()->id()
            );

            return response()->json([
                'message' => $transfer->status === StockTransfer::STATUS_PENDING_ACCEPTANCE
                    ? 'Transferência criada. Aguardando aceite do destinatário.'
                    : 'Transferência efetivada com sucesso.',
                'transfer' => $transfer,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            Log::error('StockTransfer store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar transferência de estoque.'], 500);
        }
    }

    public function accept(Request $request, StockTransfer $transfer): JsonResponse
    {
        $this->authorizeTenant($transfer);

        if ($transfer->to_user_id && $transfer->to_user_id !== auth()->id()) {
            return response()->json(['message' => 'Apenas o destinatário pode aceitar esta transferência.'], 403);
        }

        try {
            $transfer = $this->transferService->acceptTransfer($transfer, auth()->id());
            return response()->json([
                'message' => 'Transferência aceita e efetivada.',
                'transfer' => $transfer->load(['items.product', 'fromWarehouse', 'toWarehouse']),
            ]);
        } catch (\Exception $e) {
            Log::error('StockTransfer accept failed', ['transfer_id' => $transfer->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao aceitar transferência: ' . $e->getMessage()], 500);
        }
    }

    public function reject(Request $request, StockTransfer $transfer): JsonResponse
    {
        $this->authorizeTenant($transfer);

        if ($transfer->to_user_id && $transfer->to_user_id !== auth()->id()) {
            return response()->json(['message' => 'Apenas o destinatário pode rejeitar esta transferência.'], 403);
        }

        try {
            $reason = $request->validate(['rejection_reason' => 'nullable|string|max:500'])['rejection_reason'] ?? null;
            $transfer = $this->transferService->rejectTransfer($transfer, auth()->id(), $reason);
            return response()->json([
                'message' => 'Transferência rejeitada.',
                'transfer' => $transfer,
            ]);
        } catch (\Exception $e) {
            Log::error('StockTransfer reject failed', ['transfer_id' => $transfer->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao rejeitar transferência.'], 500);
        }
    }

    protected function authorizeTenant(StockTransfer $transfer): void
    {
        $tenantId = $this->resolvedTenantId();
        if ($transfer->tenant_id !== $tenantId) {
            abort(404);
        }
    }
}
