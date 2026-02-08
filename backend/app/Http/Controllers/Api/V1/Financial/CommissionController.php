<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\CommissionRule;
use App\Models\CommissionEvent;
use App\Models\CommissionSettlement;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommissionController extends Controller
{
    // ── Regras ──

    public function rules(Request $request): JsonResponse
    {
        $query = CommissionRule::with('user:id,name');

        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($role = $request->get('applies_to_role')) {
            $query->where('applies_to_role', $role);
        }

        return response()->json($query->orderBy('priority')->orderBy('name')->get());
    }

    public function storeRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'name' => 'required|string|max:255',
            'type' => 'sometimes|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'applies_to' => 'sometimes|in:all,products,services',
            'calculation_type' => 'required|in:' . implode(',', array_keys(CommissionRule::CALCULATION_TYPES)),
            'applies_to_role' => 'sometimes|in:technician,seller,driver',
            'applies_when' => 'sometimes|in:os_completed,installment_paid,os_invoiced',
            'tiers' => 'nullable|array',
            'priority' => 'sometimes|integer',
        ]);

        $rule = CommissionRule::create($validated);
        return response()->json($rule->load('user:id,name'), 201);
    }

    public function updateRule(Request $request, CommissionRule $commissionRule): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|in:percentage,fixed',
            'value' => 'sometimes|numeric|min:0',
            'applies_to' => 'sometimes|in:all,products,services',
            'calculation_type' => 'sometimes|in:' . implode(',', array_keys(CommissionRule::CALCULATION_TYPES)),
            'applies_to_role' => 'sometimes|in:technician,seller,driver',
            'applies_when' => 'sometimes|in:os_completed,installment_paid,os_invoiced',
            'tiers' => 'nullable|array',
            'priority' => 'sometimes|integer',
            'active' => 'sometimes|boolean',
        ]);

        $commissionRule->update($validated);
        return response()->json($commissionRule->fresh()->load('user:id,name'));
    }

    public function destroyRule(CommissionRule $commissionRule): JsonResponse
    {
        $commissionRule->delete();
        return response()->json(null, 204);
    }

    /** Tipos de cálculo disponíveis */
    public function calculationTypes(): JsonResponse
    {
        return response()->json(CommissionRule::CALCULATION_TYPES);
    }

    // ── Eventos ──

    public function events(Request $request): JsonResponse
    {
        $query = CommissionEvent::with([
            'user:id,name', 'workOrder:id,number', 'rule:id,name,calculation_type',
        ]);

        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }
        if ($period = $request->get('period')) {
            $query->whereRaw("DATE_FORMAT(created_at, '%Y-%m') = ?", [$period]);
        }

        return response()->json(
            $query->orderByDesc('created_at')->paginate($request->get('per_page', 50))
        );
    }

    /** Gerar comissões para uma OS — suporta 10+ calculation_types */
    public function generateForWorkOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
        ]);

        $wo = \App\Models\WorkOrder::with(['items', 'technicians'])->findOrFail($validated['work_order_id']);

        $existing = CommissionEvent::where('work_order_id', $wo->id)->exists();
        if ($existing) {
            return response()->json(['message' => 'Comissões já geradas para esta OS'], 422);
        }

        // Monta contexto de cálculo
        $expensesTotal = Expense::where('work_order_id', $wo->id)
            ->where('status', 'approved')
            ->sum('amount');

        $productsTotal = $wo->items->where('type', 'product')->sum('total');
        $servicesTotal = $wo->items->where('type', 'service')->sum('total');

        $context = [
            'gross' => (float) $wo->total,
            'expenses' => (float) $expensesTotal,
            'displacement' => 0, // TODO: item marcado como deslocamento
            'products_total' => (float) $productsTotal,
            'services_total' => (float) $servicesTotal,
            'cost' => (float) $expensesTotal, // simplificado
        ];

        $events = [];

        // Coleta todos os user_ids relevantes (técnico principal + vendedor + técnicos N:N)
        $userRoles = [];
        if ($wo->assignee_id) $userRoles[] = ['id' => $wo->assignee_id, 'role' => 'technician'];
        if ($wo->seller_id) $userRoles[] = ['id' => $wo->seller_id, 'role' => 'seller'];
        if ($wo->driver_id) $userRoles[] = ['id' => $wo->driver_id, 'role' => 'driver'];
        foreach ($wo->technicians as $tech) {
            $role = $tech->pivot->role ?? 'technician';
            if (!collect($userRoles)->contains(fn ($ur) => $ur['id'] === $tech->id && $ur['role'] === $role)) {
                $userRoles[] = ['id' => $tech->id, 'role' => $role];
            }
        }

        foreach ($userRoles as $ur) {
            $rules = CommissionRule::where('user_id', $ur['id'])
                ->where('applies_to_role', $ur['role'])
                ->where('active', true)
                ->orderBy('priority')
                ->get();

            foreach ($rules as $rule) {
                $commissionAmount = $rule->calculateCommission((float) $wo->total, $context);
                if ($commissionAmount <= 0) continue;

                $events[] = CommissionEvent::create([
                    'commission_rule_id' => $rule->id,
                    'work_order_id' => $wo->id,
                    'user_id' => $ur['id'],
                    'base_amount' => (float) $wo->total,
                    'commission_amount' => $commissionAmount,
                    'status' => 'pending',
                    'notes' => "Tipo: {$rule->calculation_type}, Papel: {$ur['role']}",
                ]);
            }
        }

        return response()->json(['generated' => count($events), 'events' => $events], 201);
    }

    /** Simular comissão (preview sem salvar) */
    public function simulate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
        ]);

        $wo = \App\Models\WorkOrder::with(['items', 'technicians'])->findOrFail($validated['work_order_id']);

        $expensesTotal = Expense::where('work_order_id', $wo->id)
            ->where('status', 'approved')
            ->sum('amount');

        $context = [
            'gross' => (float) $wo->total,
            'expenses' => (float) $expensesTotal,
            'displacement' => 0,
            'products_total' => (float) $wo->items->where('type', 'product')->sum('total'),
            'services_total' => (float) $wo->items->where('type', 'service')->sum('total'),
            'cost' => (float) $expensesTotal,
        ];

        $simulations = [];
        $userIds = array_filter([$wo->assignee_id, $wo->seller_id, $wo->driver_id]);
        foreach ($wo->technicians as $tech) $userIds[] = $tech->id;
        $userIds = array_unique($userIds);

        foreach ($userIds as $uid) {
            $rules = CommissionRule::where('user_id', $uid)->where('active', true)->get();
            foreach ($rules as $rule) {
                $amount = $rule->calculateCommission((float) $wo->total, $context);
                $simulations[] = [
                    'user_id' => $uid,
                    'user_name' => $rule->user?->name,
                    'rule_name' => $rule->name,
                    'calculation_type' => $rule->calculation_type,
                    'applies_to_role' => $rule->applies_to_role,
                    'base_amount' => (float) $wo->total,
                    'commission_amount' => $amount,
                ];
            }
        }

        return response()->json($simulations);
    }

    public function updateEventStatus(Request $request, CommissionEvent $commissionEvent): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,approved,paid,reversed',
            'notes' => 'nullable|string',
        ]);

        $commissionEvent->update($validated);
        return response()->json($commissionEvent->fresh());
    }

    // ── Fechamento ──

    public function settlements(Request $request): JsonResponse
    {
        $query = CommissionSettlement::with('user:id,name');

        if ($period = $request->get('period')) {
            $query->where('period', $period);
        }
        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }

        return response()->json($query->orderByDesc('period')->get());
    }

    public function closeSettlement(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'period' => 'required|string|size:7',
        ]);

        $events = CommissionEvent::where('user_id', $validated['user_id'])
            ->where('status', 'approved')
            ->whereRaw("DATE_FORMAT(created_at, '%Y-%m') = ?", [$validated['period']])
            ->get();

        if ($events->isEmpty()) {
            return response()->json(['message' => 'Nenhum evento aprovado para este período'], 422);
        }

        $settlement = CommissionSettlement::updateOrCreate(
            ['user_id' => $validated['user_id'], 'period' => $validated['period']],
            [
                'total_amount' => $events->sum('commission_amount'),
                'events_count' => $events->count(),
                'status' => 'closed',
            ]
        );

        $events->each(fn ($e) => $e->update(['status' => 'paid']));

        return response()->json($settlement->load('user:id,name'), 201);
    }

    public function paySettlement(CommissionSettlement $commissionSettlement): JsonResponse
    {
        $commissionSettlement->update(['status' => 'paid', 'paid_at' => now()]);
        return response()->json($commissionSettlement->fresh());
    }

    // ── Summary ──

    public function summary(): JsonResponse
    {
        $pendingTotal = CommissionEvent::where('status', 'pending')->sum('commission_amount');
        $approvedTotal = CommissionEvent::where('status', 'approved')->sum('commission_amount');
        $paidMonth = CommissionEvent::where('status', 'paid')
            ->whereMonth('updated_at', now()->month)
            ->whereYear('updated_at', now()->year)
            ->sum('commission_amount');

        return response()->json([
            'pending' => (float) $pendingTotal,
            'approved' => (float) $approvedTotal,
            'paid_this_month' => (float) $paidMonth,
            'calculation_types_count' => count(CommissionRule::CALCULATION_TYPES),
        ]);
    }
}
