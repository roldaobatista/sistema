<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CrmActivity;
use App\Models\CrmDeal;
use App\Models\Customer;
use App\Models\WorkOrder;
use App\Models\CommissionEvent;
use App\Models\Expense;
use App\Models\Equipment;
use App\Models\Product;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'date_from' => 'nullable|date',
                'date_to' => 'nullable|date|after_or_equal:date_from',
            ]);

            $from = $request->date('date_from') ?? now()->startOfMonth();
            $to   = $request->date('date_to')   ?? now()->endOfDay();

        $openOs = WorkOrder::whereNotIn('status', [WorkOrder::STATUS_COMPLETED, WorkOrder::STATUS_CANCELLED])->count();
        $inProgressOs = WorkOrder::where('status', WorkOrder::STATUS_IN_PROGRESS)->count();
        $completedMonth = WorkOrder::where('status', WorkOrder::STATUS_COMPLETED)
            ->where('updated_at', '>=', $from)->count();
        $revenueMonth = WorkOrder::where('status', WorkOrder::STATUS_COMPLETED)
            ->where('updated_at', '>=', $from)->sum('total');

        $pendingCommissions = CommissionEvent::where('status', CommissionEvent::STATUS_PENDING)->sum('commission_amount');
        $expensesMonth = Expense::where('status', Expense::STATUS_APPROVED)
            ->where('expense_date', '>=', $from)->sum('amount');

        $recentOs = WorkOrder::with(['customer:id,name', 'assignee:id,name'])
            ->orderByDesc('created_at')
            ->take(10)
            ->get(['id', 'number', 'customer_id', 'assignee_id', 'status', 'total', 'created_at']);

        $topTechnicians = WorkOrder::select('assignee_id', DB::raw('COUNT(*) as os_count'), DB::raw('SUM(total) as total_revenue'))
            ->where('status', WorkOrder::STATUS_COMPLETED)
            ->where('updated_at', '>=', $from)
            ->whereNotNull('assignee_id')
            ->groupBy('assignee_id')
            ->orderByDesc('os_count')
            ->take(5)
            ->with('assignee:id,name')
            ->get();

        // Equipamentos - alertas
        $eqOverdue = Equipment::overdue()->active()->count();
        $eqDue7 = Equipment::calibrationDue(7)->active()->count() - $eqOverdue;
        $eqAlerts = Equipment::calibrationDue(30)
            ->active()
            ->with('customer:id,name')
            ->orderBy('next_calibration_at')
            ->take(5)
            ->get(['id', 'code', 'brand', 'model', 'customer_id', 'next_calibration_at']);

        // CRM KPIs
        $openDeals = CrmDeal::where('status', CrmDeal::STATUS_OPEN)->count();
        $wonDealsMonth = CrmDeal::where('status', CrmDeal::STATUS_WON)
            ->where('closed_at', '>=', $from)->count();
        $crmRevenueMonth = CrmDeal::where('status', CrmDeal::STATUS_WON)
            ->where('closed_at', '>=', $from)->sum('value');
        $pendingFollowUps = CrmActivity::where('type', 'tarefa')
            ->where('is_done', false)
            ->where('scheduled_at', '<=', now())->count();
        $avgHealthScore = (int) Customer::where('is_active', true)
            ->whereNotNull('health_score')->avg('health_score');

        // Financeiro
        $receivablesPending = AccountReceivable::whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL])
            ->sum('amount');
        $receivablesOverdue = AccountReceivable::whereIn('status', [AccountReceivable::STATUS_PENDING, AccountReceivable::STATUS_PARTIAL])
            ->where('due_date', '<', now())->sum('amount');
        $payablesPending = AccountPayable::whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_PARTIAL])
            ->sum('amount');
        $payablesOverdue = AccountPayable::whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_PARTIAL])
            ->where('due_date', '<', now())->sum('amount');
        $netRevenue = (float) $revenueMonth - (float) $expensesMonth;

        // SLA — contagens
        $slaResponseBreached = WorkOrder::where('sla_response_breached', true)
            ->where('created_at', '>=', $from)->count();
        $slaResolutionBreached = WorkOrder::where('sla_resolution_breached', true)
            ->where('created_at', '>=', $from)->count();
        $slaTotal = WorkOrder::whereNotNull('sla_policy_id')
            ->where('created_at', '>=', $from)->count();

        // Monthly Revenue (last 6 months)
        $monthlyRevenue = [];
        for ($i = 5; $i >= 0; $i--) {
            $mStart = now()->subMonths($i)->startOfMonth();
            $mEnd = now()->subMonths($i)->endOfMonth();
            $total = (float) WorkOrder::where('status', WorkOrder::STATUS_COMPLETED)
                ->whereBetween('updated_at', [$mStart, $mEnd])
                ->sum('total');
            $monthlyRevenue[] = [
                'month' => $mStart->format('M'),
                'total' => $total,
            ];
        }

        // Avg completion time (hours)
        $avgHours = WorkOrder::where('status', WorkOrder::STATUS_COMPLETED)
            ->whereNotNull('completed_at')
            ->whereNotNull('created_at')
            ->where('updated_at', '>=', $from)
            ->get(['created_at', 'completed_at']);
        $totalH = 0;
        $cnt = count($avgHours);
        foreach ($avgHours as $wo) {
            $totalH += $wo->created_at->diffInHours($wo->completed_at);
        }
        $avgCompletionHours = $cnt > 0 ? round($totalH / $cnt) : 0;

        return response()->json([
            'open_os' => $openOs,
            'in_progress_os' => $inProgressOs,
            'completed_month' => $completedMonth,
            'revenue_month' => (float) $revenueMonth,
            'pending_commissions' => (float) $pendingCommissions,
            'expenses_month' => (float) $expensesMonth,
            'recent_os' => $recentOs,
            'top_technicians' => $topTechnicians,
            'eq_overdue' => $eqOverdue,
            'eq_due_7' => max(0, $eqDue7),
            'eq_alerts' => $eqAlerts,
            // CRM
            'crm_open_deals' => $openDeals,
            'crm_won_month' => $wonDealsMonth,
            'crm_revenue_month' => (float) $crmRevenueMonth,
            'crm_pending_followups' => $pendingFollowUps,
            'crm_avg_health' => $avgHealthScore,
            // Estoque
            'stock_low' => Product::where('is_active', true)
                ->whereColumn('stock_qty', '<=', 'stock_min')
                ->where('stock_qty', '>', 0)->count(),
            'stock_out' => Product::where('is_active', true)
                ->where('stock_qty', '<=', 0)->count(),
            // Financeiro
            'receivables_pending' => (float) $receivablesPending,
            'receivables_overdue' => (float) $receivablesOverdue,
            'payables_pending' => (float) $payablesPending,
            'payables_overdue' => (float) $payablesOverdue,
            'net_revenue' => $netRevenue,
            // SLA
            'sla_total' => $slaTotal,
            'sla_response_breached' => $slaResponseBreached,
            'sla_resolution_breached' => $slaResolutionBreached,
            // Charts
            'monthly_revenue' => $monthlyRevenue,
            'avg_completion_hours' => $avgCompletionHours,
        ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Parametros invalidos', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Dashboard stats failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erro ao carregar dashboard'], 500);
        }
    }
}
