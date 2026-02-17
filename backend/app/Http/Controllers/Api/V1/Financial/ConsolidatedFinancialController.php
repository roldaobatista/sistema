<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\ResolvesCurrentTenant;
use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\Expense;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ConsolidatedFinancialController extends Controller
{
    use ResolvesCurrentTenant;

    private function userTenantIds(Request $request): array
    {
        $user = $request->user();
        $ids = $user->tenants()->pluck('tenants.id')->toArray();

        if (empty($ids)) {
            $ids = [$this->resolvedTenantId()];
        }

        return $ids;
    }

    /**
     * GET /financial/consolidated
     * Returns a consolidated financial summary across all tenants the user has access to.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $tenantIds = $this->userTenantIds($request);
            $tenantFilter = $request->input('tenant_id');

            if ($tenantFilter && in_array((int) $tenantFilter, $tenantIds, true)) {
                $tenantIds = [(int) $tenantFilter];
            }

            if (empty($tenantIds)) {
                return response()->json(['message' => 'Nenhum tenant disponível.'], 403);
            }

            $today = Carbon::today();
            $startMonth = $today->copy()->startOfMonth();
            $endMonth = $today->copy()->endOfMonth();

            // Receivables summary per tenant
            $receivablesByTenant = AccountReceivable::whereIn('tenant_id', $tenantIds)
                ->select('tenant_id')
                ->selectRaw("SUM(CASE WHEN status NOT IN ('paid','cancelled') THEN (amount - amount_paid) ELSE 0 END) as open_total")
                ->selectRaw("SUM(CASE WHEN status NOT IN ('paid','cancelled') AND due_date < ? THEN (amount - amount_paid) ELSE 0 END) as overdue_total", [$today])
                ->selectRaw("SUM(CASE WHEN status = 'paid' AND paid_at >= ? AND paid_at <= ? THEN amount ELSE 0 END) as received_month", [$startMonth, $endMonth])
                ->groupBy('tenant_id')
                ->get()
                ->keyBy('tenant_id');

            // Payables summary per tenant
            $payablesByTenant = AccountPayable::whereIn('tenant_id', $tenantIds)
                ->select('tenant_id')
                ->selectRaw("SUM(CASE WHEN status NOT IN ('paid','cancelled') THEN amount ELSE 0 END) as open_total")
                ->selectRaw("SUM(CASE WHEN status NOT IN ('paid','cancelled') AND due_date < ? THEN amount ELSE 0 END) as overdue_total", [$today])
                ->selectRaw("SUM(CASE WHEN status = 'paid' AND paid_at >= ? AND paid_at <= ? THEN amount ELSE 0 END) as paid_month", [$startMonth, $endMonth])
                ->groupBy('tenant_id')
                ->get()
                ->keyBy('tenant_id');

            // Expenses summary per tenant (current month)
            $expensesByTenant = Expense::whereIn('tenant_id', $tenantIds)
                ->whereNull('deleted_at')
                ->where('status', Expense::STATUS_APPROVED)
                ->whereBetween('expense_date', [$startMonth, $endMonth])
                ->select('tenant_id')
                ->selectRaw('SUM(amount) as total')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('tenant_id')
                ->get()
                ->keyBy('tenant_id');

            // OS invoiced this month per tenant
            $invoicedByTenant = WorkOrder::whereIn('tenant_id', $tenantIds)
                ->where('status', WorkOrder::STATUS_INVOICED)
                ->whereBetween('updated_at', [$startMonth, $endMonth])
                ->select('tenant_id')
                ->selectRaw('SUM(total) as total')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('tenant_id')
                ->get()
                ->keyBy('tenant_id');

            // Tenants info
            $tenants = DB::table('tenants')
                ->whereIn('id', $tenantIds)
                ->select('id', 'name', 'document')
                ->get()
                ->keyBy('id');

            $perTenant = [];
            $totals = [
                'receivables_open' => 0,
                'receivables_overdue' => 0,
                'received_month' => 0,
                'payables_open' => 0,
                'payables_overdue' => 0,
                'paid_month' => 0,
                'expenses_month' => 0,
                'invoiced_month' => 0,
            ];

            foreach ($tenantIds as $tid) {
                $rec = $receivablesByTenant[$tid] ?? null;
                $pay = $payablesByTenant[$tid] ?? null;
                $exp = $expensesByTenant[$tid] ?? null;
                $inv = $invoicedByTenant[$tid] ?? null;
                $tenant = $tenants[$tid] ?? null;

                $row = [
                    'tenant_id' => $tid,
                    'tenant_name' => $tenant->name ?? "Tenant #{$tid}",
                    'tenant_document' => $tenant->document ?? null,
                    'receivables_open' => (float) ($rec->open_total ?? 0),
                    'receivables_overdue' => (float) ($rec->overdue_total ?? 0),
                    'received_month' => (float) ($rec->received_month ?? 0),
                    'payables_open' => (float) ($pay->open_total ?? 0),
                    'payables_overdue' => (float) ($pay->overdue_total ?? 0),
                    'paid_month' => (float) ($pay->paid_month ?? 0),
                    'expenses_month' => (float) ($exp->total ?? 0),
                    'invoiced_month' => (float) ($inv->total ?? 0),
                ];

                $perTenant[] = $row;

                foreach ($totals as $key => &$val) {
                    $val += $row[$key];
                }
            }

            return response()->json([
                'period' => $startMonth->format('Y-m'),
                'totals' => $totals,
                'balance' => $totals['receivables_open'] - $totals['payables_open'],
                'per_tenant' => $perTenant,
            ]);
        } catch (\Exception $e) {
            Log::error('Consolidated financial failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao carregar dados financeiros consolidados.'], 500);
        }
    }
}
