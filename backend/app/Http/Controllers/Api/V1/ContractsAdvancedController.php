<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\RecurringContract;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class ContractsAdvancedController extends Controller
{
    // ─── #38 Reajuste Automático de Contrato ───────────────────

    public function pendingAdjustments(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;

        $contracts = DB::table('recurring_contracts')
            ->where('company_id', $tenantId)
            ->where('status', 'active')
            ->whereNotNull('adjustment_index')
            ->whereRaw('next_adjustment_date <= ?', [now()->addDays(30)])
            ->get();

        return response()->json([
            'pending_count' => $contracts->count(),
            'contracts' => $contracts,
        ]);
    }

    public function applyAdjustment(Request $request, int $contractId): JsonResponse
    {
        $request->validate([
            'index_rate' => 'required|numeric|min:-50|max:100',
            'effective_date' => 'required|date',
        ]);

        $contract = DB::table('recurring_contracts')
            ->where('id', $contractId)
            ->where('company_id', $request->user()->company_id)
            ->first();

        if (!$contract) return response()->json(['message' => 'Not found'], 404);

        $rate = $request->input('index_rate') / 100;
        $oldValue = $contract->monthly_value;
        $newValue = round($oldValue * (1 + $rate), 2);

        DB::table('contract_adjustments')->insert([
            'contract_id' => $contractId,
            'company_id' => $request->user()->company_id,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'index_rate' => $request->input('index_rate'),
            'effective_date' => $request->input('effective_date'),
            'applied_by' => $request->user()->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        DB::table('recurring_contracts')->where('id', $contractId)->update([
            'monthly_value' => $newValue,
            'next_adjustment_date' => Carbon::parse($request->input('effective_date'))->addYear(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Adjustment applied',
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'change_percent' => round($rate * 100, 2),
        ]);
    }

    // ─── #39 Alerta de Vencimento (Churn Prevention) ───────────

    public function churnRisk(Request $request): JsonResponse
    {
        $tenantId = $request->user()->company_id;
        $days = $request->input('days', 60);

        $expiring = DB::table('recurring_contracts')
            ->where('company_id', $tenantId)
            ->where('status', 'active')
            ->whereNotNull('end_date')
            ->whereRaw('end_date BETWEEN ? AND ?', [now(), now()->addDays($days)])
            ->join('customers', 'recurring_contracts.customer_id', '=', 'customers.id')
            ->select('recurring_contracts.*', 'customers.nome_fantasia as customer_name')
            ->orderBy('end_date')
            ->get();

        // Categorize risk
        $risk = $expiring->map(function ($c) {
            $daysLeft = now()->diffInDays(Carbon::parse($c->end_date), false);
            return array_merge((array) $c, [
                'days_until_expiry' => $daysLeft,
                'risk_level' => $daysLeft <= 15 ? 'critical' : ($daysLeft <= 30 ? 'high' : 'medium'),
            ]);
        });

        return response()->json([
            'total_at_risk' => $risk->count(),
            'total_mrr_at_risk' => round($risk->sum('monthly_value'), 2),
            'by_risk_level' => [
                'critical' => $risk->where('risk_level', 'critical')->count(),
                'high' => $risk->where('risk_level', 'high')->count(),
                'medium' => $risk->where('risk_level', 'medium')->count(),
            ],
            'contracts' => $risk,
        ]);
    }

    // ─── #40 Gestão de Aditivos Contratuais ────────────────────

    public function contractAddendums(Request $request, int $contractId): JsonResponse
    {
        $addendums = DB::table('contract_addendums')
            ->where('contract_id', $contractId)
            ->where('company_id', $request->user()->company_id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json($addendums);
    }

    public function createAddendum(Request $request, int $contractId): JsonResponse
    {
        $data = $request->validate([
            'type' => 'required|string|in:value_change,scope_change,term_extension,cancellation',
            'description' => 'required|string',
            'new_value' => 'nullable|numeric|min:0',
            'new_end_date' => 'nullable|date',
            'effective_date' => 'required|date',
        ]);

        $tenantId = $request->user()->company_id;

        $id = DB::table('contract_addendums')->insertGetId([
            'contract_id' => $contractId,
            'company_id' => $tenantId,
            'type' => $data['type'],
            'description' => $data['description'],
            'new_value' => $data['new_value'] ?? null,
            'new_end_date' => $data['new_end_date'] ?? null,
            'effective_date' => $data['effective_date'],
            'status' => 'pending',
            'created_by' => $request->user()->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['id' => $id, 'message' => 'Addendum created'], 201);
    }

    public function approveAddendum(Request $request, int $addendumId): JsonResponse
    {
        $addendum = DB::table('contract_addendums')
            ->where('id', $addendumId)
            ->where('company_id', $request->user()->company_id)
            ->first();

        if (!$addendum) return response()->json(['message' => 'Not found'], 404);

        DB::table('contract_addendums')->where('id', $addendumId)->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'updated_at' => now(),
        ]);

        // Apply changes to contract
        $updates = ['updated_at' => now()];
        if ($addendum->new_value) $updates['monthly_value'] = $addendum->new_value;
        if ($addendum->new_end_date) $updates['end_date'] = $addendum->new_end_date;
        if ($addendum->type === 'cancellation') $updates['status'] = 'cancelled';

        DB::table('recurring_contracts')->where('id', $addendum->contract_id)->update($updates);

        return response()->json(['message' => 'Addendum approved and applied']);
    }

    // ─── #41 Medição de Contrato (Aceite Parcial) ──────────────

    public function contractMeasurements(Request $request, int $contractId): JsonResponse
    {
        $measurements = DB::table('contract_measurements')
            ->where('contract_id', $contractId)
            ->where('company_id', $request->user()->company_id)
            ->orderByDesc('period')
            ->paginate(20);

        return response()->json($measurements);
    }

    public function storeMeasurement(Request $request, int $contractId): JsonResponse
    {
        $data = $request->validate([
            'period' => 'required|string', // e.g., "2026-02"
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|numeric|min:0',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.accepted' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        $tenantId = $request->user()->company_id;
        $totalAccepted = 0;
        $totalRejected = 0;

        foreach ($data['items'] as $item) {
            $total = $item['quantity'] * $item['unit_price'];
            if ($item['accepted'] ?? true) {
                $totalAccepted += $total;
            } else {
                $totalRejected += $total;
            }
        }

        $id = DB::table('contract_measurements')->insertGetId([
            'contract_id' => $contractId,
            'company_id' => $tenantId,
            'period' => $data['period'],
            'items' => json_encode($data['items']),
            'total_accepted' => round($totalAccepted, 2),
            'total_rejected' => round($totalRejected, 2),
            'notes' => $data['notes'] ?? null,
            'status' => 'pending_approval',
            'created_by' => $request->user()->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json([
            'id' => $id,
            'total_accepted' => round($totalAccepted, 2),
            'total_rejected' => round($totalRejected, 2),
        ], 201);
    }
}
