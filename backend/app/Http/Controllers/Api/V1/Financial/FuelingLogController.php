<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Models\FuelingLog;
use App\Models\TechnicianCashFund;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class FuelingLogController extends Controller
{
    use ResolvesCurrentTenant;

    public function index(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();

            $query = FuelingLog::where('tenant_id', $tenantId)
                ->with(['user:id,name', 'workOrder:id,os_number', 'approver:id,name']);

            if ($request->filled('user_id')) {
                $query->where('user_id', $request->user_id);
            }
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }
            if ($request->filled('date_from')) {
                $query->whereDate('fueling_date', '>=', $request->date_from);
            }
            if ($request->filled('date_to')) {
                $query->whereDate('fueling_date', '<=', $request->date_to);
            }
            if ($request->filled('search')) {
                $s = $request->search;
                $query->where(function ($q) use ($s) {
                    $q->where('vehicle_plate', 'like', "%{$s}%")
                      ->orWhere('gas_station_name', 'like', "%{$s}%");
                });
            }

            $logs = $query->orderByDesc('fueling_date')->paginate($request->input('per_page', 25));

            return response()->json($logs);
        } catch (\Exception $e) {
            Log::error('FuelingLog index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao listar abastecimentos'], 500);
        }
    }

    public function show(Request $request, FuelingLog $fuelingLog): JsonResponse
    {
        try {
            if ($fuelingLog->tenant_id !== $this->resolvedTenantId()) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }
            $fuelingLog->load(['user:id,name', 'workOrder:id,os_number', 'approver:id,name']);
            return response()->json($fuelingLog);
        } catch (\Exception $e) {
            Log::error('FuelingLog show failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar abastecimento'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();

            $validated = $request->validate([
                'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where('tenant_id', $tenantId)],
                'vehicle_plate' => 'required|string|max:20',
                'odometer_km' => 'required|numeric|min:0',
                'gas_station' => 'nullable|string|max:255',
                'fuel_type' => ['required', Rule::in(array_keys(FuelingLog::FUEL_TYPES))],
                'liters' => 'required|numeric|min:0.01',
                'price_per_liter' => 'required|numeric|min:0.01',
                'total_amount' => 'required|numeric|min:0.01',
                'date' => 'required|date',
                'notes' => 'nullable|string|max:1000',
                'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
                'affects_technician_cash' => 'boolean',
            ]);

            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store("tenants/{$tenantId}/fueling-receipts", 'public');
                $receiptPath = "/storage/{$path}";
            }

            $log = DB::transaction(function () use ($validated, $tenantId, $request, $receiptPath) {
                return FuelingLog::create([
                    'tenant_id' => $tenantId,
                    'user_id' => $request->user()->id,
                    'work_order_id' => $validated['work_order_id'] ?? null,
                    'vehicle_plate' => $validated['vehicle_plate'],
                    'odometer_km' => $validated['odometer_km'],
                    'gas_station_name' => $validated['gas_station'] ?? null,
                    'fuel_type' => $validated['fuel_type'],
                    'liters' => $validated['liters'],
                    'price_per_liter' => $validated['price_per_liter'],
                    'total_amount' => $validated['total_amount'],
                    'fueling_date' => $validated['date'],
                    'notes' => $validated['notes'] ?? null,
                    'receipt_path' => $receiptPath,
                    'affects_technician_cash' => $validated['affects_technician_cash'] ?? false,
                    'status' => FuelingLog::STATUS_PENDING,
                ]);
            });

            return response()->json($log->load(['user:id,name', 'workOrder:id,os_number']), 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('FuelingLog store failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao registrar abastecimento'], 500);
        }
    }

    public function update(Request $request, FuelingLog $fuelingLog): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();

            if ($fuelingLog->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            if ($fuelingLog->status !== FuelingLog::STATUS_PENDING) {
                return response()->json(['message' => 'Apenas registros pendentes podem ser editados'], 422);
            }

            $validated = $request->validate([
                'work_order_id' => ['nullable', Rule::exists('work_orders', 'id')->where('tenant_id', $tenantId)],
                'vehicle_plate' => 'sometimes|string|max:20',
                'odometer_km' => 'sometimes|numeric|min:0',
                'gas_station' => 'nullable|string|max:255',
                'fuel_type' => ['sometimes', Rule::in(array_keys(FuelingLog::FUEL_TYPES))],
                'liters' => 'sometimes|numeric|min:0.01',
                'price_per_liter' => 'sometimes|numeric|min:0.01',
                'total_amount' => 'sometimes|numeric|min:0.01',
                'date' => 'sometimes|date',
                'notes' => 'nullable|string|max:1000',
                'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
                'affects_technician_cash' => 'boolean',
            ]);

            $data = [];
            if (isset($validated['vehicle_plate'])) $data['vehicle_plate'] = $validated['vehicle_plate'];
            if (isset($validated['odometer_km'])) $data['odometer_km'] = $validated['odometer_km'];
            if (array_key_exists('gas_station', $validated)) $data['gas_station_name'] = $validated['gas_station'];
            if (isset($validated['fuel_type'])) $data['fuel_type'] = $validated['fuel_type'];
            if (isset($validated['liters'])) $data['liters'] = $validated['liters'];
            if (isset($validated['price_per_liter'])) $data['price_per_liter'] = $validated['price_per_liter'];
            if (isset($validated['total_amount'])) $data['total_amount'] = $validated['total_amount'];
            if (isset($validated['date'])) $data['fueling_date'] = $validated['date'];
            if (array_key_exists('notes', $validated)) $data['notes'] = $validated['notes'];
            if (array_key_exists('work_order_id', $validated)) $data['work_order_id'] = $validated['work_order_id'];
            if (isset($validated['affects_technician_cash'])) $data['affects_technician_cash'] = $validated['affects_technician_cash'];

            if ($request->hasFile('receipt')) {
                if ($fuelingLog->receipt_path) {
                    $oldPath = str_replace('/storage/', '', $fuelingLog->receipt_path);
                    Storage::disk('public')->delete($oldPath);
                }
                $path = $request->file('receipt')->store("tenants/{$tenantId}/fueling-receipts", 'public');
                $data['receipt_path'] = "/storage/{$path}";
            }

            DB::transaction(fn () => $fuelingLog->update($data));

            return response()->json($fuelingLog->fresh()->load(['user:id,name', 'workOrder:id,os_number']));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('FuelingLog update failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao atualizar abastecimento'], 500);
        }
    }

    public function approve(Request $request, FuelingLog $fuelingLog): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();

            if ($fuelingLog->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            $validated = $request->validate([
                'action' => ['required', Rule::in(['approve', 'reject'])],
                'rejection_reason' => 'nullable|string|max:500',
            ]);

            if ($fuelingLog->status !== FuelingLog::STATUS_PENDING && $fuelingLog->status !== FuelingLog::STATUS_REJECTED) {
                return response()->json(['message' => 'Apenas registros pendentes podem ser aprovados/rejeitados'], 422);
            }

            $isApprove = $validated['action'] === 'approve';
            $rejectionReason = trim((string) ($validated['rejection_reason'] ?? ''));

            if (!$isApprove && $rejectionReason === '') {
                return response()->json([
                    'message' => 'Informe o motivo da rejeição',
                    'errors' => ['rejection_reason' => ['O motivo da rejeição é obrigatório.']],
                ], 422);
            }

            DB::transaction(function () use ($fuelingLog, $isApprove, $rejectionReason, $request, $tenantId) {
                $fuelingLog->update([
                    'status' => $isApprove ? FuelingLog::STATUS_APPROVED : FuelingLog::STATUS_REJECTED,
                    'approved_by' => $request->user()->id,
                    'approved_at' => now(),
                    'rejection_reason' => $isApprove ? null : $rejectionReason,
                ]);

                if ($isApprove && $fuelingLog->affects_technician_cash && $fuelingLog->user_id) {
                    $fund = TechnicianCashFund::getOrCreate($fuelingLog->user_id, $tenantId);
                    $fund->addDebit(
                        (float) $fuelingLog->total_amount,
                        "Abastecimento #{$fuelingLog->id}: {$fuelingLog->vehicle_plate} - {$fuelingLog->liters}L",
                        null,
                        $request->user()->id,
                        $fuelingLog->work_order_id,
                        allowNegative: true,
                    );
                }
            });

            return response()->json($fuelingLog->fresh()->load(['user:id,name', 'approver:id,name']));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('FuelingLog approve failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao aprovar/rejeitar abastecimento'], 500);
        }
    }

    public function resubmit(Request $request, FuelingLog $fuelingLog): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();

            if ($fuelingLog->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            if ($fuelingLog->status !== FuelingLog::STATUS_REJECTED) {
                return response()->json(['message' => 'Apenas registros rejeitados podem ser resubmetidos'], 422);
            }

            DB::transaction(function () use ($fuelingLog) {
                $fuelingLog->update([
                    'status' => FuelingLog::STATUS_PENDING,
                    'approved_by' => null,
                    'approved_at' => null,
                    'rejection_reason' => null,
                ]);
            });

            return response()->json($fuelingLog->fresh()->load(['user:id,name', 'workOrder:id,os_number']));
        } catch (\Exception $e) {
            Log::error('FuelingLog resubmit failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao resubmeter abastecimento'], 500);
        }
    }

    public function destroy(Request $request, FuelingLog $fuelingLog): JsonResponse
    {
        try {
            $tenantId = $this->resolvedTenantId();

            if ((int) $fuelingLog->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Acesso negado'], 403);
            }

            if ($fuelingLog->status !== FuelingLog::STATUS_PENDING) {
                return response()->json(['message' => 'Apenas registros pendentes podem ser excluídos'], 422);
            }

            if ($fuelingLog->receipt_path) {
                $oldPath = str_replace('/storage/', '', $fuelingLog->receipt_path);
                Storage::disk('public')->delete($oldPath);
            }

            DB::transaction(fn () => $fuelingLog->delete());

            return response()->json(['message' => 'Registro excluído']);
        } catch (\Exception $e) {
            Log::error('FuelingLog destroy failed', ['id' => $fuelingLog->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir registro'], 500);
        }
    }
}
